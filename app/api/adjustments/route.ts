import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month  = searchParams.get('month')  || '';
  const empId  = searchParams.get('empId')  || '';
  const applied = searchParams.get('applied');

  const db = createServerSupabase();
  let query = db.from('NSC_HR_adjustments')
    .select('*, employee:NSC_HR_employees(id,employee_code,full_name,department,emp_type)', { count: 'exact' });

  if (month)  query = query.eq('adj_month', month);
  if (empId)  query = query.eq('employee_id', empId);
  if (applied !== null && applied !== '') query = query.eq('applied', applied === 'true');

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await req.json();
    const { employee_id, adj_month, adj_type, amount, reason } = body;

    if (!employee_id || !adj_month || !adj_type || amount === undefined) {
      return NextResponse.json({ error: 'employee_id, adj_month, adj_type, amount are required' }, { status: 400 });
    }

    const db = createServerSupabase();
    const { data, error } = await db.from('NSC_HR_adjustments').insert({
      employee_id,
      adj_month,
      adj_type,
      amount: parseFloat(amount),
      reason: reason || null,
      applied: false,
      created_by: session.id,
    }).select('*, employee:NSC_HR_employees(id,employee_code,full_name,department,emp_type)').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await db.from('NSC_HR_activity_logs').insert({
      user_id: session.id, action: 'CREATE_ADJUSTMENT',
      entity_type: 'adjustment', entity_id: data.id,
      details: { employee_id, adj_month, adj_type, amount },
    });

    return NextResponse.json({ data, message: 'Adjustment added' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create adjustment' }, { status: 500 });
  }
}
