import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id  = searchParams.get('project_id')  || '';
  const activeParam = searchParams.get('active'); // 'true' | 'false' | null (null = all)

  // Employees can only see their own assignments
  const employee_id = session.role === 'employee'
    ? (session.employee_id || '')
    : (searchParams.get('employee_id') || '');

  const db = createServerSupabase();
  let query = db
    .from('NSC_HR_project_assignments')
    .select('*, employee:NSC_HR_employees(id,full_name,employee_code,emp_type,department), project:NSC_HR_projects(id,project_name,status)', { count: 'exact' });

  if (project_id)  query = query.eq('project_id',  project_id);
  if (employee_id) query = query.eq('employee_id', employee_id);
  if (activeParam === 'true')  query = query.eq('active', true);
  if (activeParam === 'false') query = query.eq('active', false);

  query = query.order('assigned_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    if (!body.project_id)  return NextResponse.json({ error: 'Project is required' }, { status: 400 });
    if (!body.employee_id) return NextResponse.json({ error: 'Employee is required' }, { status: 400 });
    if (body.rate === undefined || Number(body.rate) < 0) return NextResponse.json({ error: 'Rate must be 0 or more' }, { status: 400 });

    const db = createServerSupabase();

    // Only part-time employees can be assigned to projects
    const { data: emp } = await db.from('NSC_HR_employees').select('emp_type').eq('id', body.employee_id).single();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if (emp.emp_type === 'permanent') return NextResponse.json({ error: 'Only temporary employees can be assigned to projects' }, { status: 400 });

    // Check project is active
    const { data: proj } = await db.from('NSC_HR_projects').select('status').eq('id', body.project_id).single();
    if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (proj.status !== 'active') return NextResponse.json({ error: 'Project is not active' }, { status: 400 });

    // Upsert: if already assigned update rate, else create
    const { data, error } = await db
      .from('NSC_HR_project_assignments')
      .upsert({
        project_id:  body.project_id,
        employee_id: body.employee_id,
        rate:        Number(body.rate),
        rate_type:   body.rate_type || 'per_unit',
        active:      true,
      }, { onConflict: 'project_id,employee_id' })
      .select('*, employee:NSC_HR_employees(id,full_name,employee_code,emp_type), project:NSC_HR_projects(id,project_name)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Employee assigned to project' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to assign employee' }, { status: 500 });
  }
}
