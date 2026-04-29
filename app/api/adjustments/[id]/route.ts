import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const db = createServerSupabase();

  const { data: adj } = await db.from('NSC_HR_adjustments').select('*').eq('id', id).single();
  if (!adj) return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
  if (adj.applied) return NextResponse.json({ error: 'Cannot delete an adjustment that has already been applied to payroll' }, { status: 400 });

  const { error } = await db.from('NSC_HR_adjustments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id, action: 'DELETE_ADJUSTMENT',
    entity_type: 'adjustment', entity_id: id,
    details: { adj_type: adj.adj_type, amount: adj.amount, adj_month: adj.adj_month },
  });

  return NextResponse.json({ message: 'Adjustment deleted' });
}
