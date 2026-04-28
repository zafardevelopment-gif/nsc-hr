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
    .select('*', { count: 'exact' });

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
    const { month } = body;
    const db = createServerSupabase();

    // Get settings
    const { data: settings } = await db.from('NSC_HR_settings').select('*');
    const getSetting = (key: string, def = '0') => settings?.find(s => s.setting_key === key)?.setting_value || def;
    const pfRate = parseFloat(getSetting('pf_rate', '12')) / 100;
    const profTax = parseFloat(getSetting('professional_tax', '200'));
    const hraRate = parseFloat(getSetting('hra_rate', '25')) / 100;
    const conveyance = parseFloat(getSetting('conveyance', '3000'));

    // Get all active employees
    const { data: employees } = await db.from('NSC_HR_employees').select('*').eq('active', true);
    if (!employees) return NextResponse.json({ error: 'No employees found' }, { status: 400 });

    const results = [];

    for (const emp of employees) {
      // Check if already exists
      const { data: existing } = await db.from('NSC_HR_payroll')
        .select('id').eq('employee_id', emp.id).eq('payroll_month', month).single();
      if (existing) continue;

      let basicSalary = 0, overtimePay = 0, approvedHours = 0;

      if (emp.emp_type === 'permanent' && emp.salary_type === 'monthly') {
        basicSalary = emp.monthly_salary || 0;
      } else if (emp.salary_type === 'hourly') {
        // Sum approved hours for the month
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
      const grossEarnings = basicSalary + hra + conv + overtimePay;
      const pfDeduction = emp.emp_type === 'permanent' ? basicSalary * pfRate : 0;
      const pt = emp.emp_type === 'permanent' && grossEarnings > 0 ? profTax : 0;
      const totalDeductions = pfDeduction + pt;
      const netPay = grossEarnings - totalDeductions;

      const payrollEntry = {
        employee_id: emp.id,
        payroll_month: month,
        basic_salary: basicSalary,
        hra,
        conveyance: conv,
        overtime_pay: overtimePay,
        gross_earnings: grossEarnings,
        pf_employee: pfDeduction,
        professional_tax: pt,
        total_deductions: totalDeductions,
        net_pay: netPay,
        approved_hours: approvedHours,
        status: 'generated',
        generated_by: session.id,
      };

      const { data } = await db.from('NSC_HR_payroll').insert(payrollEntry).select().single();
      if (data) results.push(data);
    }

    await db.from('NSC_HR_activity_logs').insert({
      user_id: session.id, action: 'GENERATE_PAYROLL',
      details: { month, count: results.length },
    });

    return NextResponse.json({ data: results, message: `Payroll generated for ${results.length} employees` });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to generate payroll' }, { status: 500 });
  }
}
