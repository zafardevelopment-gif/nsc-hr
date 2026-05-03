import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const db = createServerSupabase();

    // Fetch existing log to get rate
    const { data: existing } = await db
      .from('NSC_HR_project_work_logs')
      .select('rate,quantity')
      .eq('id', id)
      .single();
    if (!existing) return NextResponse.json({ error: 'Log not found' }, { status: 404 });

    const newQty   = body.quantity !== undefined ? Number(body.quantity) : existing.quantity;
    const newRate  = existing.rate;
    const newTotal = newQty * newRate;

    const update: Record<string, unknown> = {
      quantity:     newQty,
      total_amount: newTotal,
      updated_at:   new Date().toISOString(),
    };
    if (body.date  !== undefined) update.date  = body.date;
    if (body.notes !== undefined) update.notes = body.notes || null;

    const { data, error } = await db
      .from('NSC_HR_project_work_logs')
      .update(update)
      .eq('id', id)
      .select('*, employee:NSC_HR_employees(id,full_name,employee_code), project:NSC_HR_projects(id,project_name), assignment:NSC_HR_project_assignments(id,rate,rate_type)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Work log updated' });
  } catch {
    return NextResponse.json({ error: 'Failed to update work log' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createServerSupabase();
  const { error } = await db.from('NSC_HR_project_work_logs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Work log deleted' });
}
