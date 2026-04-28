import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';
  const empId = searchParams.get('empId') || '';
  const limit = parseInt(searchParams.get('limit') || '200');

  const db = createServerSupabase();
  let query = db.from('NSC_HR_leave_requests')
    .select('*, employee:NSC_HR_employees(id,full_name,employee_code,department)', { count: 'exact' });

  if (session.role === 'employee') {
    query = query.eq('employee_id', session.employee_id!);
  } else if (empId) {
    query = query.eq('employee_id', empId);
  }

  if (status) query = query.eq('status', status);
  query = query.order('created_at', { ascending: false }).limit(limit);

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

    // Check leave balance
    const year = new Date(body.from_date).getFullYear();
    const { data: balance } = await db.from('NSC_HR_leave_balances')
      .select('*')
      .eq('employee_id', empId)
      .eq('year', year)
      .eq('leave_type', body.leave_type)
      .single();

    if (balance && (balance.used_days + body.total_days) > balance.total_days) {
      return NextResponse.json({
        error: `Insufficient ${body.leave_type} balance. Available: ${balance.total_days - balance.used_days} days`,
      }, { status: 400 });
    }

    const { data, error } = await db.from('NSC_HR_leave_requests').insert({
      employee_id: empId,
      leave_type: body.leave_type,
      from_date: body.from_date,
      to_date: body.to_date,
      total_days: body.total_days,
      reason: body.reason,
      status: 'pending',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await db.from('NSC_HR_notifications').insert({
      title: 'New Leave Request',
      message: `${body.leave_type} request for ${body.total_days} day(s) submitted`,
      target_role: 'admin',
      notification_type: 'in-app',
    });

    return NextResponse.json({ data, message: 'Leave request submitted' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to submit leave request' }, { status: 500 });
  }
}
