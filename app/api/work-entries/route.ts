import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';
  const empId = searchParams.get('empId') || '';
  const month = searchParams.get('month') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const db = createServerSupabase();
  let query = db.from('NSC_HR_work_entries')
    .select('*, employee:NSC_HR_employees(id,full_name,employee_code,department), payroll_item:NSC_HR_payroll_items(payroll_id), project:NSC_HR_projects(id,project_name)', { count: 'exact' });

  // Employees can only see their own entries
  if (session.role === 'employee') {
    query = query.eq('employee_id', session.employee_id!);
  } else if (empId) {
    query = query.eq('employee_id', empId);
  }

  if (status) query = query.eq('status', status);
  if (month) {
    const [year, m] = month.split('-');
    const start = `${year}-${m}-01`;
    const end = new Date(parseInt(year), parseInt(m), 0).toISOString().split('T')[0];
    query = query.gte('entry_date', start).lte('entry_date', end);
  }

  query = query.order('entry_date', { ascending: false }).order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten payroll_item join into a top-level payroll_id field
  const enriched = (data || []).map((e: Record<string, unknown> & { payroll_item?: { payroll_id: string } | null }) => {
    const { payroll_item, ...rest } = e;
    return { ...rest, payroll_id: payroll_item?.payroll_id ?? null };
  });

  return NextResponse.json({ data: enriched, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const db = createServerSupabase();

    const empId = session.role === 'employee' ? session.employee_id! : body.employee_id;

    // Check if manual approval is required
    const { data: approvalSetting } = await db.from('NSC_HR_settings')
      .select('setting_value')
      .eq('setting_key', 'work_entry_manual_approval')
      .single();
    const isManual = approvalSetting?.setting_value === 'true';
    const status = isManual ? 'pending' : 'approved';

    // If auto-approve: block if same employee already has an approved entry on this date
    if (!isManual) {
      const { data: conflict } = await db.from('NSC_HR_work_entries')
        .select('id')
        .eq('employee_id', empId)
        .eq('entry_date', body.entry_date)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();
      if (conflict) {
        return NextResponse.json(
          { error: 'Is din ki ek entry already approve ho chuki hai.' },
          { status: 409 }
        );
      }
    }

    const entry = {
      employee_id: empId,
      entry_date: body.entry_date,
      start_time: body.start_time,
      end_time: body.end_time,
      total_hours: body.total_hours,
      adjusted_hours: isManual ? null : body.total_hours,
      task_description: body.task_description,
      proof_url: body.proof_url,
      proof_filename: body.proof_filename,
      project_id: body.project_id || null,
      status,
    };

    const { data, error } = await db.from('NSC_HR_work_entries').insert(entry).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (isManual) {
      // Notify admin for manual review
      await db.from('NSC_HR_notifications').insert({
        title: 'New Work Entry',
        message: `A new work entry has been submitted for ${body.entry_date} — pending your approval`,
        target_role: 'admin',
        notification_type: 'in-app',
      });
    } else {
      // Notify employee that entry was auto-approved
      await db.from('NSC_HR_notifications').insert({
        title: 'Work Entry Approved',
        message: `Your work entry for ${body.entry_date} (${body.total_hours}h) has been automatically approved`,
        employee_id: empId,
        notification_type: 'in-app',
      });
    }

    return NextResponse.json({ data, message: isManual ? 'Work entry submitted — pending approval' : 'Work entry submitted and auto-approved' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to submit work entry' }, { status: 500 });
  }
}
