import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase';

export async function POST() {
  try {
    const session = await getSession();
    if (session) {
      const db = createServerSupabase();
      await db.from('NSC_HR_activity_logs').insert({
        user_id: session.id,
        action: 'LOGOUT',
        details: { username: session.username },
      });
    }
    await clearSession();
    return NextResponse.json({ message: 'Logged out successfully' });
  } catch {
    await clearSession();
    return NextResponse.json({ message: 'Logged out' });
  }
}
