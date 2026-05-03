import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const db = createServerSupabase();

  const { data: entry } = await db.from('NSC_HR_work_entries')
    .select('*, employee:NSC_HR_employees(id,emp_type,hourly_rate)')
    .eq('id', id).single();
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  const wasApproved = entry.status === 'approved';
  const becomingApproved = body.status === 'approved';

  const updateData: Record<string, unknown> = {
    status: body.status,
    admin_remark: body.admin_remark,
    reviewed_by: session.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (body.adjusted_hours !== undefined) updateData.adjusted_hours = body.adjusted_hours;

  const { data, error } = await db.from('NSC_HR_work_entries').update(updateData).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-create project work log when a part-time employee's entry is approved and has a project
  const emp = entry.employee as { id: string; emp_type: string; hourly_rate?: number } | null;
  if (becomingApproved && !wasApproved && emp?.emp_type === 'part-time' && entry.project_id) {
    // Get employee's assignment rate for this project
    const { data: assignment } = await db.from('NSC_HR_project_assignments')
      .select('id, rate, rate_type')
      .eq('employee_id', entry.employee_id)
      .eq('project_id', entry.project_id)
      .eq('active', true)
      .maybeSingle();

    const hours = body.adjusted_hours ?? entry.adjusted_hours ?? entry.total_hours;
    const rate = assignment?.rate ?? emp.hourly_rate ?? 0;
    const total = hours * rate;

    // Insert project work log (skip if already exists for this work entry)
    await db.from('NSC_HR_project_work_logs').upsert({
      employee_id:   entry.employee_id,
      project_id:    entry.project_id,
      assignment_id: assignment?.id ?? null,
      work_entry_id: id,
      quantity:      hours,
      rate,
      total_amount:  Math.round(total * 100) / 100,
      date:          entry.entry_date,
      notes:         entry.task_description,
      created_by:    session.id,
    }, { onConflict: 'work_entry_id' }).select();
  }

  // Notify employee
  await db.from('NSC_HR_notifications').insert({
    title: `Work Entry ${body.status === 'approved' ? 'Approved' : 'Rejected'}`,
    message: `Your work entry for ${entry.entry_date} has been ${body.status}${body.admin_remark ? ': ' + body.admin_remark : ''}`,
    employee_id: entry.employee_id,
    notification_type: 'in-app',
  });

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id, action: `WORK_ENTRY_${body.status.toUpperCase()}`,
    entity_type: 'work_entry', entity_id: id,
    details: { employee_id: entry.employee_id },
  });

  return NextResponse.json({ data, message: `Work entry ${body.status}` });
}
