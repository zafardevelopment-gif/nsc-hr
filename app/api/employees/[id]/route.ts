import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createServerSupabase();

  const { data: emp } = await db.from('NSC_HR_employees').select('*').eq('id', id).single();
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const { data: user } = await db.from('NSC_HR_users')
    .select('id, username, active, last_login')
    .eq('employee_id', id)
    .single();

  return NextResponse.json({ data: { ...emp, user } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { username, password, ...empData } = body;

  const db = createServerSupabase();

  empData.updated_at = new Date().toISOString();
  const { data, error } = await db.from('NSC_HR_employees').update(empData).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update user credentials if provided
  if (username || password) {
    const { data: existUser } = await db.from('NSC_HR_users').select('id').eq('employee_id', id).single();
    if (existUser) {
      const updateData: Record<string, unknown> = {};
      if (username) updateData.username = username.toLowerCase().trim();
      if (password) updateData.password_hash = await hashPassword(password);
      await db.from('NSC_HR_users').update(updateData).eq('id', existUser.id);
    }
  }

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id, action: 'UPDATE_EMPLOYEE',
    entity_type: 'employee', entity_id: id,
    details: { name: data.full_name },
  });

  return NextResponse.json({ data, message: 'Employee updated successfully' });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const db = createServerSupabase();

  // Soft delete — just deactivate
  await db.from('NSC_HR_employees').update({ active: false }).eq('id', id);
  await db.from('NSC_HR_users').update({ active: false }).eq('employee_id', id);

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id, action: 'DEACTIVATE_EMPLOYEE',
    entity_type: 'employee', entity_id: id,
  });

  return NextResponse.json({ message: 'Employee deactivated' });
}
