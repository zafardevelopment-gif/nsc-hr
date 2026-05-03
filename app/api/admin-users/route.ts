import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession, hashPassword } from '@/lib/auth';

function isSuperAdmin(session: { role: string; role_type?: string }) {
  return session.role === 'admin' && (!session.role_type || session.role_type === 'super_admin');
}

export async function GET() {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerSupabase();
  const { data, error } = await db
    .from('NSC_HR_users')
    .select('id, username, role, role_type, active, last_login')
    .eq('role', 'admin')
    .order('username');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { username, password, role_type } = body;

    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password min 6 characters' }, { status: 400 });
    if (!['super_admin', 'admin', 'staff'].includes(role_type)) return NextResponse.json({ error: 'Invalid role type' }, { status: 400 });

    const db = createServerSupabase();
    const password_hash = await hashPassword(password);

    const { data, error } = await db.from('NSC_HR_users').insert({
      username: username.trim().toLowerCase(),
      password_hash,
      role: 'admin',
      role_type,
      active: true,
    }).select('id, username, role, role_type, active').single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, message: 'Admin user created' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
