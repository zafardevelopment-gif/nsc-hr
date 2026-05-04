import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession, hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const { newPassword } = await req.json();

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const db = createServerSupabase();

  const { data: user } = await db.from('NSC_HR_users').select('id').eq('employee_id', id).single();
  if (!user) {
    return NextResponse.json({ error: 'No login account found for this employee' }, { status: 404 });
  }

  const hash = await hashPassword(newPassword);
  await db.from('NSC_HR_users').update({ password_hash: hash, login_attempts: 0, locked_until: null }).eq('id', user.id);

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id,
    action: 'RESET_PASSWORD',
    entity_type: 'employee',
    entity_id: id,
    details: { admin: session.username, target_user_id: user.id },
  });

  return NextResponse.json({ message: 'Password reset successfully' });
}
