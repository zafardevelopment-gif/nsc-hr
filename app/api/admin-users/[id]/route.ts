import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

function isSuperAdmin(session: { role: string; role_type?: string }) {
  return session.role === 'admin' && (!session.role_type || session.role_type === 'super_admin');
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (id === session.id) return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 });

  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.active !== undefined) update.active = body.active;
  if (body.role_type) {
    if (!['super_admin', 'admin', 'staff'].includes(body.role_type))
      return NextResponse.json({ error: 'Invalid role type' }, { status: 400 });
    update.role_type = body.role_type;
  }

  const db = createServerSupabase();
  const { data, error } = await db.from('NSC_HR_users').update(update).eq('id', id).select('id, username, role_type, active').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, message: 'User updated' });
}
