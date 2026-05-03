import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

function isSuperAdmin(session: { role: string; role_type?: string }) {
  return session.role === 'admin' && (!session.role_type || session.role_type === 'super_admin');
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type       = searchParams.get('type') || '';
  const from       = searchParams.get('from') || '';
  const to         = searchParams.get('to') || '';
  const project_id = searchParams.get('project_id') || '';
  const limit      = parseInt(searchParams.get('limit') || '500');

  const db = createServerSupabase();
  let query = db
    .from('NSC_HR_finance_entries')
    .select('*, project:NSC_HR_projects(id,project_name)', { count: 'exact' });

  if (type)       query = query.eq('type', type);
  if (from)       query = query.gte('date', from);
  if (to)         query = query.lte('date', to);
  if (project_id) query = query.eq('project_id', project_id);

  query = query.order('date', { ascending: false }).limit(limit);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const db = createServerSupabase();

    const insert: Record<string, unknown> = {
      type:         body.type,
      date:         body.date,
      description:  body.description,
      amount:       body.amount,
      payment_mode: body.payment_mode || null,
      reference:    body.reference    || null,
      notes:        body.notes        || null,
      project_id:   body.project_id   || null,
      created_by:   session.id,
    };

    if (body.type === 'earning') {
      insert.received_from = body.received_from || null;
    } else {
      insert.paid_to   = body.paid_to   || null;
      insert.category  = body.category  || null;
    }

    const { data, error } = await db.from('NSC_HR_finance_entries').insert(insert)
      .select('*, project:NSC_HR_projects(id,project_name)').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Entry saved' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}
