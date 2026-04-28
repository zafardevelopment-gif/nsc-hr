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
    .select('*')
    .eq('id', id).single();
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

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
