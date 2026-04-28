import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerSupabase();
  const { data, error } = await db
    .from('NSC_HR_departments')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Department name required' }, { status: 400 });

  const db = createServerSupabase();
  const { data, error } = await db
    .from('NSC_HR_departments')
    .insert({ name, description: body.description || null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Department already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id, action: 'CREATE_DEPARTMENT',
    entity_type: 'department', entity_id: data.id,
    details: { name },
  });

  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const db = createServerSupabase();

  // Soft delete — mark inactive
  const { error } = await db
    .from('NSC_HR_departments')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id, action: 'DELETE_DEPARTMENT',
    entity_type: 'department', entity_id: id,
  });

  return NextResponse.json({ message: 'Department deleted' });
}
