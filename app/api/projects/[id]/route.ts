import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createServerSupabase();
  const { data, error } = await db.from('NSC_HR_projects').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const db = createServerSupabase();

    const update: Record<string, unknown> = {};
    if (body.project_name !== undefined) update.project_name = body.project_name.trim();
    if (body.project_cost !== undefined) update.project_cost = body.project_cost ? Number(body.project_cost) : null;
    if (body.client_name  !== undefined) update.client_name  = body.client_name  || null;
    if (body.start_date   !== undefined) update.start_date   = body.start_date   || null;
    if (body.end_date     !== undefined) update.end_date     = body.end_date     || null;
    if (body.description  !== undefined) update.description  = body.description  || null;
    if (body.status       !== undefined) update.status       = body.status;

    const { data, error } = await db.from('NSC_HR_projects').update(update).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Project updated' });
  } catch {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createServerSupabase();

  const { count } = await db
    .from('NSC_HR_project_work_logs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', id);
  if (count && count > 0) {
    return NextResponse.json({ error: 'Cannot delete: work logs exist. Deactivate instead.' }, { status: 400 });
  }

  const { error } = await db.from('NSC_HR_projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Project deleted' });
}
