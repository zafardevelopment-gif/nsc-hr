import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';

  const db = createServerSupabase();
  let query = db.from('NSC_HR_projects').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.project_name?.trim()) return NextResponse.json({ error: 'Project name is required' }, { status: 400 });

    const db = createServerSupabase();
    const { data, error } = await db.from('NSC_HR_projects').insert({
      project_name: body.project_name.trim(),
      project_cost: body.project_cost ? Number(body.project_cost) : null,
      client_name:  body.client_name  || null,
      start_date:   body.start_date   || null,
      end_date:     body.end_date     || null,
      description:  body.description  || null,
      status:       body.status       || 'active',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Project created' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
