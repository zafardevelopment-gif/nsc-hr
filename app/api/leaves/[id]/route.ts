import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const db = createServerSupabase();

  const { data: leave } = await db.from('NSC_HR_leave_requests')
    .select('*')
    .eq('id', id).single();
  if (!leave) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });

  const { data, error } = await db.from('NSC_HR_leave_requests').update({
    status: body.status,
    admin_remark: body.admin_remark,
    reviewed_by: session.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update leave balance on approval
  if (body.status === 'approved') {
    const year = new Date(leave.from_date).getFullYear();
    await db.from('NSC_HR_leave_balances')
      .update({ used_days: db.rpc('used_days') })
      .eq('employee_id', leave.employee_id)
      .eq('year', year)
      .eq('leave_type', leave.leave_type);

    // Direct update
    const { data: bal } = await db.from('NSC_HR_leave_balances')
      .select('used_days')
      .eq('employee_id', leave.employee_id)
      .eq('year', year)
      .eq('leave_type', leave.leave_type)
      .single();

    if (bal) {
      await db.from('NSC_HR_leave_balances').update({
        used_days: bal.used_days + leave.total_days,
      }).eq('employee_id', leave.employee_id).eq('year', year).eq('leave_type', leave.leave_type);
    }
  }

  await db.from('NSC_HR_notifications').insert({
    title: `Leave ${body.status === 'approved' ? 'Approved' : 'Rejected'}`,
    message: `Your ${leave.leave_type} from ${leave.from_date} to ${leave.to_date} has been ${body.status}`,
    employee_id: leave.employee_id,
    notification_type: 'in-app',
  });

  return NextResponse.json({ data, message: `Leave ${body.status}` });
}
