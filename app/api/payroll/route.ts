import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month  = searchParams.get('month') || '';
  const dept   = searchParams.get('dept') || '';
  const status = searchParams.get('status') || '';
  const empId  = searchParams.get('empId') || '';

  const db = createServerSupabase();
  let query = db.from('NSC_HR_payroll')
    .select('*, employee:NSC_HR_employees(id,employee_code,full_name,department,emp_type,salary_type,hourly_rate)', { count: 'exact' });

  if (session.role === 'employee') {
    query = query.eq('employee_id', session.employee_id!);
  } else if (empId) {
    query = query.eq('employee_id', empId);
  }

  if (month)  query = query.eq('payroll_month', month);
  if (status) query = query.eq('status', status);

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await req.json();
    const { month, empId, supplement } = body;
    const db = createServerSupabase();

    // Settings
    const { data: settings } = await db.from('NSC_HR_settings').select('*');
    const getSetting = (key: string, def = '0') =>
      settings?.find(s => s.setting_key === key)?.setting_value || def;
    const hraRate   = parseFloat(getSetting('hra_rate', '25')) / 100;
    const conveyance = parseFloat(getSetting('conveyance', '3000'));

    // Active employees — optionally filtered to one
    let empQuery = db.from('NSC_HR_employees').select('*').eq('active', true);
    if (empId) empQuery = empQuery.eq('id', empId);
    const { data: employees } = await empQuery;
    if (!employees || employees.length === 0)
      return NextResponse.json({ error: 'No employees found' }, { status: 400 });

    const results = [];

    for (const emp of employees) {
      if (supplement) {
        // ── SUPPLEMENT PATH ───────────────────────────────────────────────
        // Fetch ALL approved entries for the month that have NO payroll_items link yet.
        // These are the only entries that belong in this supplement.
        const [year, m] = month.split('-');
        const start = `${year}-${m}-01`;
        const end   = new Date(parseInt(year), parseInt(m), 0).toISOString().split('T')[0];

        // All approved entries for the month
        const { data: allEntries } = await db.from('NSC_HR_work_entries')
          .select('id, total_hours, adjusted_hours')
          .eq('employee_id', emp.id)
          .eq('status', 'approved')
          .gte('entry_date', start)
          .lte('entry_date', end);

        if (!allEntries || allEntries.length === 0) {
          console.log(`[SUPPLEMENT] emp=${emp.id} — no approved entries`);
          continue;
        }

        // Find which entries already have a payroll_items record
        const { data: linkedItems } = await db.from('NSC_HR_payroll_items')
          .select('work_entry_id')
          .in('work_entry_id', allEntries.map(e => e.id));

        const linkedSet = new Set((linkedItems || []).map(i => i.work_entry_id));
        const unlinkedEntries = allEntries.filter(e => !linkedSet.has(e.id));

        if (unlinkedEntries.length === 0) {
          console.log(`[SUPPLEMENT] emp=${emp.id} — all entries already linked`);
          continue;
        }

        const supplementHours = unlinkedEntries.reduce(
          (s, e) => s + (e.adjusted_hours || e.total_hours), 0
        );
        const supplementBasic = Math.round(supplementHours * (emp.hourly_rate || 0) * 100) / 100;

        console.log(`[SUPPLEMENT] emp=${emp.id} unlinked=${unlinkedEntries.length} hrs=${supplementHours} basic=${supplementBasic}`);

        // Insert new supplement payroll record
        const supplementEntry = {
          employee_id:       emp.id,
          payroll_month:     month,
          payroll_type:      'supplement',
          basic_salary:      supplementBasic,
          hra:               0,
          conveyance:        0,
          overtime_pay:      0,
          bonus:             0,
          advance_deduction: 0,
          gross_earnings:    supplementBasic,
          total_deductions:  0,
          net_pay:           supplementBasic,
          approved_hours:    supplementHours,
          status:            'generated',
          generated_by:      session.id,
          updated_at:        new Date().toISOString(),
        };

        const { data: newSupp, error: suppErr } = await db
          .from('NSC_HR_payroll')
          .insert(supplementEntry)
          .select()
          .single();
        if (suppErr) { console.error('Supplement insert error:', suppErr); continue; }
        if (!newSupp) continue;

        // Link the unlinked entries to this supplement
        const itemRows = unlinkedEntries.map(e => ({
          payroll_id:    newSupp.id,
          work_entry_id: e.id,
          hours:         e.adjusted_hours || e.total_hours,
          amount:        (e.adjusted_hours || e.total_hours) * (emp.hourly_rate || 0),
        }));
        const { error: itemErr } = await db.from('NSC_HR_payroll_items').insert(itemRows);
        if (itemErr) console.error('Supplement items insert error:', itemErr);

        results.push(newSupp);

      } else {
        // ── REGULAR PATH ─────────────────────────────────────────────────
        const { data: existing } = await db.from('NSC_HR_payroll')
          .select('id, status')
          .eq('employee_id', emp.id)
          .eq('payroll_month', month)
          .eq('payroll_type', 'regular')
          .maybeSingle();

        // Never recalculate a paid regular payroll
        if (existing?.status === 'paid') continue;

        // Adjustments
        const { data: allAdjs } = await db.from('NSC_HR_adjustments')
          .select('*').eq('employee_id', emp.id).eq('adj_month', month);
        const pendingAdjs    = allAdjs?.filter(a => !a.applied) || [];
        const adjBonus       = allAdjs?.filter(a => a.adj_type === 'bonus')   .reduce((s, a) => s + a.amount, 0) || 0;
        const adjOvertime    = allAdjs?.filter(a => a.adj_type === 'overtime').reduce((s, a) => s + a.amount, 0) || 0;
        const adjAdvance     = allAdjs?.filter(a => a.adj_type === 'advance') .reduce((s, a) => s + a.amount, 0) || 0;

        let basicSalary = 0, overtimePay = adjOvertime, approvedHours = 0;
        let entriesToLink: { id: string; total_hours: number; adjusted_hours?: number | null }[] = [];

        if (emp.emp_type === 'permanent' && emp.salary_type === 'monthly') {
          basicSalary = emp.monthly_salary || 0;
        } else if (emp.salary_type === 'hourly') {
          const [year, m] = month.split('-');
          const start = `${year}-${m}-01`;
          const end   = new Date(parseInt(year), parseInt(m), 0).toISOString().split('T')[0];

          const { data: entries } = await db.from('NSC_HR_work_entries')
            .select('id, total_hours, adjusted_hours')
            .eq('employee_id', emp.id)
            .eq('status', 'approved')
            .gte('entry_date', start)
            .lte('entry_date', end);

          entriesToLink  = entries || [];
          approvedHours  = entriesToLink.reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
          basicSalary    = approvedHours * (emp.hourly_rate || 0);
        } else if (emp.salary_type === 'fixed' || emp.salary_type === 'monthly') {
          basicSalary = emp.monthly_salary || 0;
        }

        const hra          = emp.emp_type === 'permanent' ? basicSalary * hraRate : 0;
        const conv         = emp.emp_type === 'permanent' ? conveyance : 0;
        const grossEarnings  = basicSalary + hra + conv + overtimePay + adjBonus;
        const totalDeductions = adjAdvance;
        const netPay        = grossEarnings - totalDeductions;

        const payrollEntry = {
          employee_id:       emp.id,
          payroll_month:     month,
          payroll_type:      'regular',
          basic_salary:      basicSalary,
          hra,
          conveyance:        conv,
          overtime_pay:      overtimePay,
          bonus:             adjBonus,
          advance_deduction: adjAdvance,
          gross_earnings:    grossEarnings,
          total_deductions:  totalDeductions,
          net_pay:           netPay,
          approved_hours:    approvedHours,
          status:            'generated',
          generated_by:      session.id,
          updated_at:        new Date().toISOString(),
        };

        let payrollId: string;

        if (existing) {
          const { data } = await db.from('NSC_HR_payroll')
            .update(payrollEntry).eq('id', existing.id).select().single();
          if (!data) continue;
          results.push(data);
          payrollId = existing.id;
          // Remove old payroll_items for this payroll (they will be re-inserted below)
          await db.from('NSC_HR_payroll_items').delete().eq('payroll_id', existing.id);
        } else {
          const { data } = await db.from('NSC_HR_payroll').insert(payrollEntry).select().single();
          if (!data) continue;
          results.push(data);
          payrollId = data.id;
        }

        // Link approved work entries to this payroll
        if (entriesToLink.length > 0) {
          const itemRows = entriesToLink.map(e => ({
            payroll_id:    payrollId,
            work_entry_id: e.id,
            hours:         e.adjusted_hours || e.total_hours,
            amount:        (e.adjusted_hours || e.total_hours) * (emp.hourly_rate || 0),
          }));
          // Upsert — in case some entries were already linked (e.g. recalculate after month boundary)
          const { error: itemErr } = await db.from('NSC_HR_payroll_items')
            .upsert(itemRows, { onConflict: 'work_entry_id' });
          if (itemErr) console.error('Regular items upsert error:', itemErr);
        }

        if (pendingAdjs.length > 0) {
          await db.from('NSC_HR_adjustments')
            .update({ applied: true, updated_at: new Date().toISOString() })
            .in('id', pendingAdjs.map(a => a.id));
        }
      }
    }

    await db.from('NSC_HR_activity_logs').insert({
      user_id: session.id,
      action:  supplement ? 'GENERATE_SUPPLEMENT_PAYROLL' : 'GENERATE_PAYROLL',
      details: { month, count: results.length, supplement: !!supplement },
    });

    const label = supplement ? 'Supplemental payroll' : 'Payroll';
    return NextResponse.json({
      data: results,
      message: `${label} processed for ${results.length} employee${results.length !== 1 ? 's' : ''}`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to generate payroll' }, { status: 500 });
  }
}
