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
    .select('*', { count: 'exact' });

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

  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const db = createServerSupabase();

    const empId = session.role === 'employee' ? session.employee_id! : body.employee_id;

    const entry = {
      employee_id: empId,
      entry_date: body.entry_date,
      start_time: body.start_time,
      end_time: body.end_time,
      total_hours: body.total_hours,
      task_description: body.task_description,
      proof_url: body.proof_url,
      proof_filename: body.proof_filename,
      status: 'pending',
    };

    const { data, error } = await db.from('NSC_HR_work_entries').insert(entry).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Create notification for admin
    await db.from('NSC_HR_notifications').insert({
      title: 'New Work Entry',
      message: `A new work entry has been submitted for ${body.entry_date}`,
      target_role: 'admin',
      notification_type: 'in-app',
    });

    return NextResponse.json({ data, message: 'Work entry submitted' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to submit work entry' }, { status: 500 });
  }
}
