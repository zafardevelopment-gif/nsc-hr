import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId, newPassword, currentPassword } = await req.json();

    const db = createServerSupabase();

    // Admin resetting another user's password
    if (session.role === 'admin' && userId && userId !== session.id) {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      const hash = await hashPassword(newPassword);
      await db.from('NSC_HR_users').update({ password_hash: hash, login_attempts: 0, locked_until: null }).eq('id', userId);
      await db.from('NSC_HR_activity_logs').insert({
        user_id: session.id, action: 'RESET_PASSWORD', entity_id: userId,
        details: { admin: session.username },
      });
      return NextResponse.json({ message: 'Password reset successfully' });
    }

    // Self password change
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
    }

    const { data: user } = await db.from('NSC_HR_users').select('password_hash').eq('id', session.id).single();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

    const hash = await hashPassword(newPassword);
    await db.from('NSC_HR_users').update({ password_hash: hash }).eq('id', session.id);

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
