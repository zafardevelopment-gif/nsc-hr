import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || '';
  const dept = searchParams.get('dept') || '';
  const active = searchParams.get('active');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  const db = createServerSupabase();
  let query = db.from('NSC_HR_employees').select('*', { count: 'exact' });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,employee_code.ilike.%${search}%,email.ilike.%${search}%,department.ilike.%${search}%`);
  }
  if (type) query = query.eq('emp_type', type);
  if (dept) query = query.eq('department', dept);
  if (active !== null && active !== '') query = query.eq('active', active === 'true');

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await req.json();
    const { username, password, ...empData } = body;

    const db = createServerSupabase();

    // Auto-generate employee code
    const { count } = await db.from('NSC_HR_employees').select('*', { count: 'exact', head: true });
    const nextNum = (count || 0) + 1;
    empData.employee_code = `NSC${String(nextNum).padStart(3, '0')}`;

    // Create employee
    const { data: emp, error: empErr } = await db.from('NSC_HR_employees').insert(empData).select().single();
    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // Create user account if username provided
    if (username && password) {
      const hash = await hashPassword(password);
      const { error: userErr } = await db.from('NSC_HR_users').insert({
        username: username.toLowerCase().trim(),
        password_hash: hash,
        role: 'employee',
        employee_id: emp.id,
        active: true,
      });
      if (userErr) {
        await db.from('NSC_HR_employees').delete().eq('id', emp.id);
        return NextResponse.json({ error: `Username taken: ${userErr.message}` }, { status: 400 });
      }
    }

    // Create default leave balances
    const year = new Date().getFullYear();
    const leaveTypes = [
      { leave_type: 'Casual Leave', total_days: 12 },
      { leave_type: 'Sick Leave', total_days: 6 },
      { leave_type: 'Emergency Leave', total_days: 3 },
    ];
    await db.from('NSC_HR_leave_balances').insert(
      leaveTypes.map(l => ({ employee_id: emp.id, year, ...l, used_days: 0 }))
    );

    await db.from('NSC_HR_activity_logs').insert({
      user_id: session.id, action: 'CREATE_EMPLOYEE',
      entity_type: 'employee', entity_id: emp.id,
      details: { employee_code: emp.employee_code, name: emp.full_name },
    });

    return NextResponse.json({ data: emp, message: 'Employee created successfully' }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
