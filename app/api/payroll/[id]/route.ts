import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const db = createServerSupabase();

  const { data: payroll } = await db.from('NSC_HR_payroll')
    .select('*')
    .eq('id', id).single();
  if (!payroll) return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.action === 'mark_paid') {
    updateData.status = 'paid';
    updateData.payment_method = body.payment_method;
    updateData.transaction_ref = body.transaction_ref;
    updateData.payment_date = body.payment_date;
    updateData.payment_notes = body.payment_notes;
    updateData.bank_last4 = body.bank_last4;
    updateData.paid_by = session.id;

    // Notify employee
    await db.from('NSC_HR_notifications').insert({
      title: 'Salary Paid',
      message: `Your salary of SAR ${payroll.net_pay.toLocaleString('en-SA')} for ${payroll.payroll_month} has been paid via ${body.payment_method}`,
      employee_id: payroll.employee_id,
      notification_type: 'in-app',
    });
  } else {
    // Manual update of amounts
    if (body.bonus !== undefined) updateData.bonus = body.bonus;
    if (body.overtime_pay !== undefined) updateData.overtime_pay = body.overtime_pay;
    if (body.advance_deduction !== undefined) updateData.advance_deduction = body.advance_deduction;
    if (body.payment_notes !== undefined) updateData.payment_notes = body.payment_notes;

    // Recalculate totals
    const gross = (payroll.basic_salary || 0) + (payroll.hra || 0) + (payroll.conveyance || 0)
      + (body.overtime_pay ?? payroll.overtime_pay ?? 0)
      + (body.bonus ?? payroll.bonus ?? 0);
    const ded = (body.advance_deduction ?? payroll.advance_deduction ?? 0);
    updateData.gross_earnings = gross;
    updateData.total_deductions = ded;
    updateData.net_pay = gross - ded;
  }

  const { data, error } = await db.from('NSC_HR_payroll').update(updateData).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark linked adjustments as applied
  if (body.adj_ids && Array.isArray(body.adj_ids) && body.adj_ids.length > 0) {
    await db.from('NSC_HR_adjustments')
      .update({ applied: true, updated_at: new Date().toISOString() })
      .in('id', body.adj_ids);
  }

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id, action: body.action === 'mark_paid' ? 'MARK_PAYROLL_PAID' : 'UPDATE_PAYROLL',
    entity_type: 'payroll', entity_id: id,
    details: { employee_id: payroll.employee_id, month: payroll.payroll_month },
  });

  return NextResponse.json({ data, message: 'Payroll updated' });
}
