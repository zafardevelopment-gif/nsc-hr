import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { verifyPassword, setSession, isLockedOut, getNewLockoutTime } from '@/lib/auth';
import { User } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { username, password, remember } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const db = createServerSupabase();

    // Fetch user
    const { data: user, error } = await db
      .from('NSC_HR_users')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Fetch employee data separately if linked
    let employee = null;
    if (user.employee_id) {
      const { data: emp } = await db
        .from('NSC_HR_employees')
        .select('*')
        .eq('id', user.employee_id)
        .single();
      employee = emp;
    }
    user.employee = employee;

    if (!user.active) {
      return NextResponse.json({ error: 'Account is deactivated. Contact admin.' }, { status: 403 });
    }

    // Check lockout
    if (isLockedOut(user.login_attempts, user.locked_until)) {
      const until = new Date(user.locked_until!);
      return NextResponse.json({
        error: `Account locked. Try again after ${until.toLocaleTimeString()}`,
      }, { status: 429 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      const attempts = (user.login_attempts || 0) + 1;
      const updateData: Record<string, unknown> = { login_attempts: attempts };
      if (attempts >= 5) updateData.locked_until = getNewLockoutTime().toISOString();

      await db.from('NSC_HR_users').update(updateData).eq('id', user.id);

      const remaining = Math.max(0, 5 - attempts);
      return NextResponse.json({
        error: remaining > 0
          ? `Invalid password. ${remaining} attempt(s) remaining.`
          : 'Account locked for 15 minutes due to too many failed attempts.',
      }, { status: 401 });
    }

    // Reset attempts on success
    await db.from('NSC_HR_users').update({
      login_attempts: 0,
      locked_until: null,
      last_login: new Date().toISOString(),
    }).eq('id', user.id);

    // Log activity
    await db.from('NSC_HR_activity_logs').insert({
      user_id: user.id,
      action: 'LOGIN',
      details: { username, role: user.role },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    });

    const sessionUser: User = {
      id: user.id,
      username: user.username,
      role: user.role,
      employee_id: user.employee_id,
      active: user.active,
      employee: user.employee,
    };

    await setSession(sessionUser, remember);

    return NextResponse.json({ user: sessionUser, message: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
