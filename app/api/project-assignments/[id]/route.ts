import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const db = createServerSupabase();

    const update: Record<string, unknown> = {};
    if (body.rate      !== undefined) update.rate      = Number(body.rate);
    if (body.rate_type !== undefined) update.rate_type = body.rate_type;
    if (body.active    !== undefined) update.active    = body.active;

    const { data, error } = await db
      .from('NSC_HR_project_assignments')
      .update(update)
      .eq('id', id)
      .select('*, employee:NSC_HR_employees(id,full_name,employee_code), project:NSC_HR_projects(id,project_name)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Assignment updated' });
  } catch {
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createServerSupabase();

  // Check if this assignment has work logs
  const { count } = await db
    .from('NSC_HR_project_work_logs')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', id);

  if (count && count > 0) {
    // Soft-delete: just deactivate
    const { error } = await db.from('NSC_HR_project_assignments').update({ active: false }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: 'Assignment deactivated (has work logs)' });
  }

  const { error } = await db.from('NSC_HR_project_assignments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Assignment removed' });
}
