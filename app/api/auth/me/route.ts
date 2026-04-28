import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServerSupabase();
    const { data: user } = await db
      .from('NSC_HR_users')
      .select('*')
      .eq('id', session.id)
      .single();

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let employee = null;
    if (user.employee_id) {
      const { data: emp } = await db
        .from('NSC_HR_employees')
        .select('*')
        .eq('id', user.employee_id)
        .single();
      employee = emp;
    }

    return NextResponse.json({ user: { ...session, employee } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
