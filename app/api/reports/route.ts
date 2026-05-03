import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'payroll';
  const month = searchParams.get('month') || '';
  const dept = searchParams.get('dept') || '';
  const db = createServerSupabase();

  async function enrichWithEmployee(rows: Record<string, unknown>[]) {
    if (!rows?.length) return rows;
    const empIds = [...new Set(rows.map(r => r.employee_id as string).filter(Boolean))];
    const { data: emps } = await db.from('NSC_HR_employees')
      .select('id, employee_code, full_name, department, emp_type')
      .in('id', empIds);
    const empMap = Object.fromEntries((emps || []).map(e => [e.id, e]));
    return rows.map(r => ({ ...r, employee: empMap[r.employee_id as string] || null }));
  }

  if (type === 'payroll') {
    let query = db.from('NSC_HR_payroll')
      .select('*, employee:NSC_HR_employees(id,employee_code,full_name,department,emp_type)');
    if (month) query = query.eq('payroll_month', month);
    const { data } = await query.order('created_at', { ascending: false });
    const rows = (data || []) as Record<string, unknown>[];
    const filtered = dept ? rows.filter(r => r.employee && (r.employee as Record<string,unknown>).department === dept) : rows;
    return NextResponse.json({ data: filtered });
  }

  if (type === 'chart') {
    // Last 7 months payroll totals for bar chart
    const months: { name: string; value: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en', { month: 'short' });
      const { data } = await db.from('NSC_HR_payroll').select('net_pay').eq('payroll_month', key);
      const total = (data || []).reduce((s: number, r: { net_pay: number }) => s + (r.net_pay || 0), 0);
      months.push({ name: label, value: total });
    }
    return NextResponse.json({ data: months });
  }

  if (type === 'attendance') {
    let query = db.from('NSC_HR_work_entries').select('*');
    if (month) {
      const [year, m] = month.split('-');
      const start = `${year}-${m}-01`;
      const end = new Date(parseInt(year), parseInt(m), 0).toISOString().split('T')[0];
      query = query.gte('entry_date', start).lte('entry_date', end);
    }
    const { data } = await query.order('entry_date', { ascending: false });
    const enriched = await enrichWithEmployee((data || []) as Record<string, unknown>[]);
    const filtered = dept ? enriched.filter(r => r.employee && (r.employee as Record<string,unknown>).department === dept) : enriched;
    return NextResponse.json({ data: filtered });
  }

  if (type === 'leave') {
    let query = db.from('NSC_HR_leave_requests').select('*');
    if (month) {
      const [year, m] = month.split('-');
      const start = `${year}-${m}-01`;
      const end = new Date(parseInt(year), parseInt(m), 0).toISOString().split('T')[0];
      query = query.gte('from_date', start).lte('from_date', end);
    }
    const { data } = await query.order('from_date', { ascending: false });
    const enriched = await enrichWithEmployee((data || []) as Record<string, unknown>[]);
    const filtered = dept ? enriched.filter(r => r.employee && (r.employee as Record<string,unknown>).department === dept) : enriched;
    return NextResponse.json({ data: filtered });
  }

  if (type === 'employees') {
    const { data } = await db.from('NSC_HR_employees').select('*').order('full_name');
    const filtered = dept ? (data || []).filter(e => e.department === dept) : (data || []);
    return NextResponse.json({ data: filtered });
  }

  if (type === 'project_pl') {
    // Project-wise Profit & Loss from the view
    const { data, error } = await db.from('NSC_HR_project_reports').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  }

  return NextResponse.json({ data: [] });
}
