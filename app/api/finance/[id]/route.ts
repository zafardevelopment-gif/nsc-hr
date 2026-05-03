import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

function isSuperAdmin(session: { role: string; role_type?: string }) {
  return session.role === 'admin' && (!session.role_type || session.role_type === 'super_admin');
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const db = createServerSupabase();

    const update: Record<string, unknown> = {
      type:         body.type,
      date:         body.date,
      description:  body.description,
      amount:       body.amount,
      payment_mode: body.payment_mode || null,
      reference:    body.reference    || null,
      notes:        body.notes        || null,
      project_id:   body.project_id   || null,
      updated_by:   session.id,
      updated_at:   new Date().toISOString(),
      received_from: body.type === 'earning' ? (body.received_from || null) : null,
      paid_to:       body.type === 'expense' ? (body.paid_to   || null) : null,
      category:      body.type === 'expense' ? (body.category  || null) : null,
    };

    const { data, error } = await db.from('NSC_HR_finance_entries').update(update).eq('id', id)
      .select('*, project:NSC_HR_projects(id,project_name)').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Entry updated' });
  } catch {
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createServerSupabase();
  const { error } = await db.from('NSC_HR_finance_entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Entry deleted' });
}
