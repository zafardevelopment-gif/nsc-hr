import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || '';
  const dept = searchParams.get('dept') || '';
  const status = searchParams.get('status') || '';
  const empId = searchParams.get('empId') || '';

  const db = createServerSupabase();
  let query = db.from('NSC_HR_payroll')
    .select('*, employee:NSC_HR_employees(id,employee_code,full_name,department,emp_type,salary_type,hourly_rate)', { count: 'exact' });

  if (session.role === 'employee') {
    query = query.eq('employee_id', session.employee_id!);
  } else if (empId) {
    query = query.eq('employee_id', empId);
  }

  if (month) query = query.eq('payroll_month', month);
  if (status) query = query.eq('status', status);
  // dept filter applied client-side after fetch when no FK join available

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await req.json();
    const { month, empId, supplement, parentPayrollId, parentCreatedAt } = body;
    const db = createServerSupabase();

    // Get settings
    const { data: settings } = await db.from('NSC_HR_settings').select('*');
    const getSetting = (key: string, def = '0') => settings?.find(s => s.setting_key === key)?.setting_value || def;
    const hraRate = parseFloat(getSetting('hra_rate', '25')) / 100;
    const conveyance = parseFloat(getSetting('conveyance', '3000'));

    // Get active employees — optionally filtered to a single employee
    let empQuery = db.from('NSC_HR_employees').select('*').eq('active', true);
    if (empId) empQuery = empQuery.eq('id', empId);
    const { data: employees } = await empQuery;
    if (!employees || employees.length === 0) return NextResponse.json({ error: 'No employees found' }, { status: 400 });

    const results = [];

    for (const emp of employees) {
      if (supplement) {
        // ── SUPPLEMENTAL PATH ──────────────────────────────────────────────
        // Only process entries approved AFTER the paid payroll was generated.
        // Never touch the existing paid record.
        if (!parentCreatedAt) continue;

        const [year, m] = month.split('-');
        const start = `${year}-${m}-01`;
        const end = new Date(parseInt(year), parseInt(m), 0).toISOString().split('T')[0];

        // Fetch only new approved entries (created after the paid payroll's created_at)
        const { data: newEntries } = await db.from('NSC_HR_work_entries')
          .select('total_hours, adjusted_hours')
          .eq('employee_id', emp.id)
          .eq('status', 'approved')
          .gte('entry_date', start).lte('entry_date', end)
          .gt('created_at', parentCreatedAt);

        if (!newEntries || newEntries.length === 0) continue;

        const supplementHours = newEntries.reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
        const supplementBasic = supplementHours * (emp.hourly_rate || 0);

        // Supplement record: only the delta (no HRA/conveyance — those were in regular)
        const supplementEntry = {
          employee_id: emp.id,
          payroll_month: month,
          payroll_type: 'supplement',
          parent_payroll_id: parentPayrollId || null,
          basic_salary: supplementBasic,
          hra: 0,
          conveyance: 0,
          overtime_pay: 0,
          bonus: 0,
          advance_deduction: 0,
          gross_earnings: supplementBasic,
          total_deductions: 0,
          net_pay: supplementBasic,
          approved_hours: supplementHours,
          status: 'generated',
          generated_by: session.id,
          updated_at: new Date().toISOString(),
        };

        // Upsert supplement record (in case Recalc is clicked again)
        const { data: existingSupplement } = await db.from('NSC_HR_payroll')
          .select('id').eq('employee_id', emp.id).eq('payroll_month', month).eq('payroll_type', 'supplement').maybeSingle();

        if (existingSupplement) {
          const { data } = await db.from('NSC_HR_payroll')
            .update(supplementEntry).eq('id', existingSupplement.id).select().single();
          if (data) results.push(data);
        } else {
          const { data } = await db.from('NSC_HR_payroll').insert(supplementEntry).select().single();
          if (data) results.push(data);
        }
      } else {
        // ── REGULAR PATH ───────────────────────────────────────────────────
        const { data: existing } = await db.from('NSC_HR_payroll')
          .select('id,status').eq('employee_id', emp.id).eq('payroll_month', month).eq('payroll_type', 'regular').maybeSingle();

        // Skip paid regular payrolls — never recalculate
        if (existing?.status === 'paid') continue;

        // Fetch ALL adjustments (applied + pending) for accurate totals
        const { data: allAdjs } = await db.from('NSC_HR_adjustments')
          .select('*').eq('employee_id', emp.id).eq('adj_month', month);
        const pendingAdjs = allAdjs?.filter(a => !a.applied) || [];

        const adjBonus    = (allAdjs?.filter(a => a.adj_type === 'bonus').reduce((s, a) => s + a.amount, 0) || 0);
        const adjOvertime = (allAdjs?.filter(a => a.adj_type === 'overtime').reduce((s, a) => s + a.amount, 0) || 0);
        const adjAdvance  = (allAdjs?.filter(a => a.adj_type === 'advance').reduce((s, a) => s + a.amount, 0) || 0);

        let basicSalary = 0, overtimePay = adjOvertime, approvedHours = 0;

        if (emp.emp_type === 'permanent' && emp.salary_type === 'monthly') {
          basicSalary = emp.monthly_salary || 0;
        } else if (emp.salary_type === 'hourly') {
          const [year, m] = month.split('-');
          const start = `${year}-${m}-01`;
          const end = new Date(parseInt(year), parseInt(m), 0).toISOString().split('T')[0];

          const { data: entries } = await db.from('NSC_HR_work_entries')
            .select('total_hours, adjusted_hours')
            .eq('employee_id', emp.id)
            .eq('status', 'approved')
            .gte('entry_date', start).lte('entry_date', end);

          approvedHours = entries?.reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0) || 0;
          basicSalary = approvedHours * (emp.hourly_rate || 0);
        } else if (emp.salary_type === 'fixed' || emp.salary_type === 'monthly') {
          basicSalary = emp.monthly_salary || 0;
        }

        const hra = emp.emp_type === 'permanent' ? basicSalary * hraRate : 0;
        const conv = emp.emp_type === 'permanent' ? conveyance : 0;
        const grossEarnings = basicSalary + hra + conv + overtimePay + adjBonus;
        const totalDeductions = adjAdvance;
        const netPay = grossEarnings - totalDeductions;

        const payrollEntry = {
          employee_id: emp.id,
          payroll_month: month,
          payroll_type: 'regular',
          basic_salary: basicSalary,
          hra,
          conveyance: conv,
          overtime_pay: overtimePay,
          bonus: adjBonus,
          advance_deduction: adjAdvance,
          gross_earnings: grossEarnings,
          total_deductions: totalDeductions,
          net_pay: netPay,
          approved_hours: approvedHours,
          status: 'generated',
          generated_by: session.id,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          const { data } = await db.from('NSC_HR_payroll')
            .update(payrollEntry).eq('id', existing.id).select().single();
          if (data) results.push(data);
        } else {
          const { data } = await db.from('NSC_HR_payroll').insert(payrollEntry).select().single();
          if (data) results.push(data);
        }

        if (pendingAdjs.length > 0) {
          await db.from('NSC_HR_adjustments')
            .update({ applied: true, updated_at: new Date().toISOString() })
            .in('id', pendingAdjs.map(a => a.id));
        }
      }
    }

    await db.from('NSC_HR_activity_logs').insert({
      user_id: session.id, action: supplement ? 'GENERATE_SUPPLEMENT_PAYROLL' : 'GENERATE_PAYROLL',
      details: { month, count: results.length, supplement: !!supplement },
    });

    const label = supplement ? 'Supplemental payroll' : 'Payroll';
    return NextResponse.json({ data: results, message: `${label} processed for ${results.length} employee${results.length !== 1 ? 's' : ''}` });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to generate payroll' }, { status: 500 });
  }
}
