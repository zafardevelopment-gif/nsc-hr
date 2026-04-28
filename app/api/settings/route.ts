import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerSupabase();
  const { data, error } = await db.from('NSC_HR_settings').select('*').order('category');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const db = createServerSupabase();

  const updates = Array.isArray(body) ? body : [body];
  const results = [];

  for (const update of updates) {
    const { data, error } = await db.from('NSC_HR_settings')
      .upsert({ setting_key: update.key, setting_value: update.value, updated_at: new Date().toISOString() },
        { onConflict: 'setting_key' })
      .select().single();
    if (!error) results.push(data);
  }

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id, action: 'UPDATE_SETTINGS',
    details: { keys: updates.map(u => u.key) },
  });

  return NextResponse.json({ data: results, message: 'Settings saved' });
}
