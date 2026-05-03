import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get('employee_id') || '';
  const project_id  = searchParams.get('project_id') || '';
  const from        = searchParams.get('from') || '';
  const to          = searchParams.get('to') || '';
  const month       = searchParams.get('month') || '';
  const limit       = parseInt(searchParams.get('limit') || '500');

  const db = createServerSupabase();
  let query = db
    .from('NSC_HR_project_work_logs')
    .select(
      '*, employee:NSC_HR_employees(id,full_name,employee_code,emp_type), project:NSC_HR_projects(id,project_name), assignment:NSC_HR_project_assignments(id,rate,rate_type)',
      { count: 'exact' }
    );

  if (session.role === 'employee') {
    query = query.eq('employee_id', session.employee_id as string);
  } else if (employee_id) {
    query = query.eq('employee_id', employee_id);
  }

  if (project_id) query = query.eq('project_id', project_id);
  if (from)       query = query.gte('date', from);
  if (to)         query = query.lte('date', to);
  if (month) {
    const [yr, mo] = month.split('-');
    const last = new Date(parseInt(yr), parseInt(mo), 0).getDate();
    query = query.gte('date', `${month}-01`).lte('date', `${month}-${last}`);
  }

  query = query.order('date', { ascending: false }).limit(limit);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    if (!body.employee_id) return NextResponse.json({ error: 'Employee is required' }, { status: 400 });
    if (!body.project_id)  return NextResponse.json({ error: 'Project is required' }, { status: 400 });
    if (!body.quantity || Number(body.quantity) <= 0) return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 });
    if (!body.date)        return NextResponse.json({ error: 'Date is required' }, { status: 400 });

    const db = createServerSupabase();

    // Verify employee is part-time
    const { data: emp } = await db.from('NSC_HR_employees').select('emp_type').eq('id', body.employee_id).single();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if (emp.emp_type === 'permanent') return NextResponse.json({ error: 'Project work logs are only for temporary staff' }, { status: 400 });

    // Verify project is active
    const { data: project } = await db.from('NSC_HR_projects').select('status').eq('id', body.project_id).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.status !== 'active') return NextResponse.json({ error: 'Cannot log work on an inactive project' }, { status: 400 });

    // Get employee's assignment rate for this project
    const { data: assignment } = await db
      .from('NSC_HR_project_assignments')
      .select('id,rate,rate_type')
      .eq('project_id', body.project_id)
      .eq('employee_id', body.employee_id)
      .eq('active', true)
      .single();

    if (!assignment) {
      return NextResponse.json(
        { error: 'This employee is not assigned to this project. Assign them first with a rate.' },
        { status: 400 }
      );
    }

    const qty   = Number(body.quantity);
    const rate  = assignment.rate;
    const total = qty * rate;

    const { data, error } = await db.from('NSC_HR_project_work_logs').insert({
      employee_id:   body.employee_id,
      project_id:    body.project_id,
      assignment_id: assignment.id,
      quantity:      qty,
      rate:          rate,
      total_amount:  total,
      date:          body.date,
      notes:         body.notes || null,
      created_by:    session.id,
    }).select(
      '*, employee:NSC_HR_employees(id,full_name,employee_code), project:NSC_HR_projects(id,project_name), assignment:NSC_HR_project_assignments(id,rate,rate_type)'
    ).single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Work log saved' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save work log' }, { status: 500 });
  }
}
