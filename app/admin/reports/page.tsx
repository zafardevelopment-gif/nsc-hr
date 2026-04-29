'use client';
import { useState, useEffect } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useUser } from '@/lib/hooks';
import { formatCurrency, getMonthOptions, formatDate } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Pagination } from '@/components/ui/Pagination';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'payroll',    label: 'Salary' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave',      label: 'Leave' },
  { key: 'employees',  label: 'Employees' },
  { key: 'finance',    label: 'Finance' },
  { key: 'id_expiry',  label: 'ID Expiry' },
];
const PAGE_SIZE = 15;

const DOC_TYPES: Record<string, string> = {
  iqama: 'Iqama', passport: 'Passport', national_id: 'National ID',
  driving_license: 'Driving License', work_permit: 'Work Permit', visa: 'Visa', other: 'Other',
};

function docStatusColor(status: string) {
  if (status === 'expired')  return { color: '#DC2626', bg: '#FEF2F2', label: 'Expired' };
  if (status === 'expiring') return { color: '#C2410C', bg: '#FFF7ED', label: 'Expiring' };
  return { color: '#16A34A', bg: '#F0FDF4', label: 'Active' };
}

function daysUntilExpiry(d: string | undefined) {
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000);
}

export default function ReportsPage() {
  const { user } = useUser();
  const [tab, setTab] = useState('payroll');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [financeType, setFinanceType] = useState<'all' | 'earning' | 'expense'>('all');
  const [docStatus, setDocStatus] = useState<'all' | 'expired' | 'expiring' | 'active'>('all');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [empSplit, setEmpSplit] = useState({ permanent: 0, partTime: 0 });
  const monthOptions = getMonthOptions();

  useEffect(() => {
    fetch('/api/reports?type=chart').then(r => r.json()).then(j => setChartData(j.data || [])).catch(() => {});
    fetch('/api/employees?limit=500').then(r => r.json()).then(j => {
      const emps = j.data || [];
      setEmpSplit({ permanent: emps.filter((e: { emp_type: string }) => e.emp_type === 'permanent').length, partTime: emps.filter((e: { emp_type: string }) => e.emp_type === 'part-time').length });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setPage(1);
      try {
        let url = '';
        if (tab === 'finance') {
          const ft = financeType !== 'all' ? `&type=${financeType}` : '';
          const df = dateFrom ? `&from=${dateFrom}` : '';
          const dt = dateTo ? `&to=${dateTo}` : '';
          url = `/api/finance?limit=500${ft}${df}${dt}`;
        } else if (tab === 'id_expiry') {
          const ds = docStatus !== 'all' ? `&status=${docStatus}` : '';
          url = `/api/documents?limit=500${ds}`;
        } else {
          url = `/api/reports?type=${tab}&month=${month}`;
        }
        const res = await fetch(url);
        const json = await res.json();
        setData(json.data || []);
      } catch { toast.error('Failed to load report'); }
      finally { setLoading(false); }
    }
    load();
  }, [tab, month, financeType, dateFrom, dateTo, docStatus]);

  const filtered = data.filter(row => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (tab === 'finance') {
      return String(row.description || '').toLowerCase().includes(q) ||
        String(row.received_from || '').toLowerCase().includes(q) ||
        String(row.paid_to || '').toLowerCase().includes(q) ||
        String(row.category || '').toLowerCase().includes(q);
    }
    if (tab === 'id_expiry') {
      const emp = row.employee as Record<string, unknown> | undefined;
      return String(emp?.full_name || '').toLowerCase().includes(q) ||
        String(emp?.employee_code || '').toLowerCase().includes(q) ||
        String(row.number || '').toLowerCase().includes(q) ||
        String(row.document_type || '').toLowerCase().includes(q);
    }
    const emp = row.employee as Record<string, unknown> | undefined;
    return String(emp?.full_name || '').toLowerCase().includes(q)
      || String(emp?.employee_code || '').toLowerCase().includes(q)
      || String(emp?.department || row.department || '').toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Finance summaries
  const totalEarnings = data.filter(r => r.type === 'earning').reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExpenses = data.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0);
  const profitLoss = totalEarnings - totalExpenses;

  function exportExcel() {
    let rows: Record<string, unknown>[] = [];
    if (tab === 'finance') {
      rows = data.map(r => ({ Date: formatDate(String(r.date)), Type: r.type, Description: r.description, Amount: r.amount, 'Received From': r.received_from, 'Paid To': r.paid_to, Category: r.category, 'Payment Mode': r.payment_mode, Reference: r.reference }));
    } else if (tab === 'id_expiry') {
      rows = data.map(r => {
        const emp = r.employee as Record<string, unknown> | undefined;
        return { Code: emp?.employee_code, Name: emp?.full_name, Dept: emp?.department, 'Doc Type': DOC_TYPES[String(r.document_type)] || r.document_type, Number: r.number, 'Issue Date': r.issue_date ? formatDate(String(r.issue_date)) : '', 'Expiry Date': r.expiry_date ? formatDate(String(r.expiry_date)) : '', Status: r.status, 'Days Left': daysUntilExpiry(r.expiry_date as string | undefined) };
      });
    } else {
      rows = data.map(row => {
        const emp = row.employee as Record<string, unknown> | undefined;
        if (tab === 'payroll') return { Code: emp?.employee_code, Name: emp?.full_name, Dept: emp?.department, Basic: row.basic_salary, Gross: row.gross_earnings, Deductions: row.total_deductions, 'Net Pay': row.net_pay, Status: row.status };
        if (tab === 'attendance') return { Code: emp?.employee_code, Name: emp?.full_name, Date: row.entry_date, Hours: row.total_hours, Description: row.task_description, Status: row.status };
        if (tab === 'leave') return { Code: emp?.employee_code, Name: emp?.full_name, 'Leave Type': row.leave_type, From: row.from_date, To: row.to_date, Days: row.total_days, Reason: row.reason, Status: row.status };
        return { Code: row.employee_code, Name: row.full_name, Department: row.department, Designation: row.designation, Type: row.emp_type, 'Salary Type': row.salary_type, 'Monthly Salary': row.monthly_salary, 'Hourly Rate': row.hourly_rate, Joined: row.joining_date, Status: row.active ? 'Active' : 'Inactive' };
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab);
    XLSX.writeFile(wb, `nsc-hr-${tab}-${month || new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Excel exported');
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`NSC HR — ${TABS.find(t => t.key === tab)?.label} Report`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 23);

    let head: string[][] = [];
    let body: (string | number)[][] = [];

    if (tab === 'finance') {
      head = [['Date', 'Type', 'Description', 'Amount', 'Received From / Paid To', 'Category', 'Payment Mode']];
      body = paged.map(r => [formatDate(String(r.date)), String(r.type), String(r.description), formatCurrency(Number(r.amount)), String(r.received_from || r.paid_to || '—'), String(r.category || '—'), String(r.payment_mode || '—')]);
    } else if (tab === 'id_expiry') {
      head = [['Employee', 'Code', 'Doc Type', 'Number', 'Expiry Date', 'Days Left', 'Status']];
      body = paged.map(r => {
        const emp = r.employee as Record<string, unknown> | undefined;
        const days = daysUntilExpiry(r.expiry_date as string | undefined);
        return [String(emp?.full_name || ''), String(emp?.employee_code || ''), DOC_TYPES[String(r.document_type)] || String(r.document_type), String(r.number), r.expiry_date ? formatDate(String(r.expiry_date)) : '—', days === null ? '—' : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`, String(r.status)];
      });
    } else if (tab === 'payroll') {
      head = [['Employee', 'Department', 'Basic', 'Gross', 'Deductions', 'Net Pay', 'Status']];
      body = paged.map(r => {
        const emp = r.employee as Record<string, unknown> | undefined;
        return [String(emp?.full_name || ''), String(emp?.department || ''), formatCurrency(Number(r.basic_salary)), formatCurrency(Number(r.gross_earnings)), formatCurrency(Number(r.total_deductions)), formatCurrency(Number(r.net_pay)), String(r.status)];
      });
    } else {
      head = [['Employee', 'Date / Type', 'Details', 'Status']];
      body = paged.map(r => {
        const emp = r.employee as Record<string, unknown> | undefined;
        const detail = tab === 'attendance' ? `${r.total_hours}h — ${String(r.task_description || '').slice(0, 40)}` : `${r.leave_type} · ${r.total_days}d`;
        return [String(emp?.full_name || String(r.full_name || '')), String(tab === 'attendance' ? r.entry_date : `${r.from_date} – ${r.to_date}`), String(detail), String(r.status || (r.active ? 'Active' : 'Inactive'))];
      });
    }

    autoTable(doc, { head, body, startY: 28, styles: { fontSize: 9 }, headStyles: { fillColor: [59, 111, 232] } });
    doc.save(`nsc-hr-${tab}-report.pdf`);
    toast.success('PDF exported');
  }

  function handlePrint() {
    window.print();
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Reports & Analytics" user={user} />
      <div className="page-content">
        {/* Top filter row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Month picker — only for payroll / attendance / leave / employees */}
          {!['finance', 'id_expiry'].includes(tab) && (
            <select className="form-select" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)}>
              {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}

          {/* Finance-specific filters */}
          {tab === 'finance' && (
            <>
              <select className="form-select" style={{ width: 'auto' }} value={financeType} onChange={e => setFinanceType(e.target.value as typeof financeType)}>
                <option value="all">All Types</option>
                <option value="earning">Earnings</option>
                <option value="expense">Expenses</option>
              </select>
              <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 148 }} title="From" />
              <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 148 }} title="To" />
              {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</Button>}
            </>
          )}

          {/* ID Expiry filter */}
          {tab === 'id_expiry' && (
            <select className="form-select" style={{ width: 'auto' }} value={docStatus} onChange={e => setDocStatus(e.target.value as typeof docStatus)}>
              <option value="all">All Statuses</option>
              <option value="expired">Expired</option>
              <option value="expiring">Expiring Soon</option>
              <option value="active">Active</option>
            </select>
          )}

          <input className="form-input" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 140, maxWidth: 260 }} />
          <Button variant="ghost" icon="📊" onClick={exportExcel} size="sm">Excel</Button>
          <Button variant="ghost" icon="📄" onClick={exportPDF} size="sm">PDF</Button>
          <Button variant="ghost" icon="🖨️" onClick={handlePrint} size="sm">Print</Button>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setSearch(''); setPage(1); }} />

        {/* Finance summary cards */}
        {tab === 'finance' && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>EARNINGS</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#16A34A' }}>+{formatCurrency(totalEarnings)}</div>
            </div>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>EXPENSES</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626' }}>-{formatCurrency(totalExpenses)}</div>
            </div>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>PROFIT / LOSS</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: profitLoss >= 0 ? '#16A34A' : '#DC2626' }}>
                {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
              </div>
            </div>
          </div>
        )}

        {/* Charts (payroll / employees tabs only) */}
        {['payroll', 'employees'].includes(tab) && (
          <div className="reports-charts">
            <Card title="Monthly Payroll Trend">
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Payroll']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? '#3B6FE8' : 'rgba(59,111,232,0.25)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Employee Split">
              {(() => {
                const total = empSplit.permanent + empSplit.partTime;
                const permPct = total > 0 ? Math.round((empSplit.permanent / total) * 100) : 0;
                const ptPct = total > 0 ? 100 - permPct : 0;
                const pieData = total > 0 ? [{ name: 'Permanent', value: empSplit.permanent }, { name: 'Part-Time', value: empSplit.partTime }] : [{ name: 'No Data', value: 1 }];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
                    <PieChart width={140} height={140}>
                      <Pie data={pieData} cx={65} cy={65} innerRadius={42} outerRadius={60} dataKey="value" stroke="none">
                        <Cell fill="#3B6FE8" /><Cell fill="#F59E0B" />
                      </Pie>
                      <text x={70} y={60} textAnchor="middle" style={{ fontSize: 18, fontWeight: 800, fill: 'var(--text)' }}>{permPct}%</text>
                      <text x={70} y={78} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-2)' }}>Permanent</text>
                    </PieChart>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                      {[{ label: 'Permanent', color: '#3B6FE8', val: `${permPct}%`, count: empSplit.permanent }, { label: 'Part-Time', color: '#F59E0B', val: `${ptPct}%`, count: empSplit.partTime }].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          <span style={{ color: 'var(--text-2)', flex: 1 }}>{s.label}</span>
                          <span style={{ color: 'var(--text-3)', fontSize: 12, marginRight: 4 }}>{s.count}</span>
                          <span style={{ fontWeight: 700 }}>{s.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* Finance P&L chart */}
        {tab === 'finance' && !loading && (
          <Card title="Earnings vs Expenses">
            {(() => {
              const pieData = [
                { name: 'Earnings', value: totalEarnings },
                { name: 'Expenses', value: totalExpenses },
              ].filter(d => d.value > 0);
              if (pieData.length === 0) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>No data</div>;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <PieChart width={140} height={140}>
                    <Pie data={pieData} cx={65} cy={65} innerRadius={42} outerRadius={60} dataKey="value" stroke="none">
                      <Cell fill="#16A34A" />
                      <Cell fill="#DC2626" />
                    </Pie>
                  </PieChart>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[{ label: 'Earnings', color: '#16A34A', val: totalEarnings }, { label: 'Expenses', color: '#DC2626', val: totalExpenses }, { label: 'Profit/Loss', color: profitLoss >= 0 ? '#16A34A' : '#DC2626', val: profitLoss }].map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-2)', width: 80 }}>{s.label}</span>
                        <span style={{ fontWeight: 800, color: s.color }}>{formatCurrency(Math.abs(s.val))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>
        )}

        {/* Data Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <div className="card-title">{TABS.find(t => t.key === tab)?.label} Report</div>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{filtered.length} records</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
          ) : paged.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}><div className="empty-icon">📊</div><div>No data found</div></div>
          ) : (
            <>
              <div className="report-table-wrap table-wrap">
                <table className="data-table">
                  {/* --- Finance tab --- */}
                  {tab === 'finance' && (
                    <>
                      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>From / To</th><th>Category</th><th>Payment Mode</th></tr></thead>
                      <tbody>
                        {paged.map((r, i) => (
                          <tr key={i}>
                            <td className="muted">{formatDate(String(r.date))}</td>
                            <td><Badge status={String(r.type) === 'earning' ? 'active' : 'danger'}>{String(r.type) === 'earning' ? 'Earning' : 'Expense'}</Badge></td>
                            <td style={{ fontWeight: 600 }}>{String(r.description)}</td>
                            <td><strong style={{ color: String(r.type) === 'earning' ? '#16A34A' : '#DC2626' }}>{String(r.type) === 'earning' ? '+' : '-'}{formatCurrency(Number(r.amount))}</strong></td>
                            <td className="muted">{String(r.received_from || r.paid_to || '—')}</td>
                            <td>{r.category ? <Badge status="primary">{String(r.category)}</Badge> : <span className="muted">—</span>}</td>
                            <td className="muted" style={{ textTransform: 'capitalize' }}>{String(r.payment_mode || '—').replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--surface)', fontWeight: 700 }}>
                          <td colSpan={3} style={{ padding: '10px 16px', color: 'var(--text-2)' }}>Total ({filtered.length} records)</td>
                          <td style={{ padding: '10px 16px' }}>
                            {financeType === 'earning' && <span style={{ color: '#16A34A', fontWeight: 800 }}>+{formatCurrency(totalEarnings)}</span>}
                            {financeType === 'expense' && <span style={{ color: '#DC2626', fontWeight: 800 }}>-{formatCurrency(totalExpenses)}</span>}
                            {financeType === 'all' && <span style={{ color: profitLoss >= 0 ? '#16A34A' : '#DC2626', fontWeight: 800 }}>{formatCurrency(profitLoss)} P/L</span>}
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </>
                  )}

                  {/* --- ID Expiry tab --- */}
                  {tab === 'id_expiry' && (
                    <>
                      <thead><tr><th>Employee</th><th>Doc Type</th><th>Number</th><th>Issue Date</th><th>Expiry Date</th><th>Days Left</th><th>Status</th></tr></thead>
                      <tbody>
                        {paged.map((r, i) => {
                          const emp = r.employee as Record<string, unknown> | undefined;
                          const sc = docStatusColor(String(r.status));
                          const days = daysUntilExpiry(r.expiry_date as string | undefined);
                          return (
                            <tr key={i}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Avatar name={String(emp?.full_name || '')} size="sm" />
                                  <div><div style={{ fontWeight: 600 }}>{String(emp?.full_name || '—')}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{String(emp?.employee_code || '')}</div></div>
                                </div>
                              </td>
                              <td><Badge status="primary">{DOC_TYPES[String(r.document_type)] || String(r.document_type)}</Badge></td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(r.number)}</td>
                              <td className="muted">{r.issue_date ? formatDate(String(r.issue_date)) : '—'}</td>
                              <td className="muted">{r.expiry_date ? formatDate(String(r.expiry_date)) : '—'}</td>
                              <td>
                                {days === null ? <span className="muted">—</span> : (
                                  <span style={{ fontWeight: 700, color: days < 0 ? '#DC2626' : days <= 30 ? '#C2410C' : '#16A34A' }}>
                                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                                  {sc.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </>
                  )}

                  {/* --- Payroll tab --- */}
                  {tab === 'payroll' && (
                    <>
                      <thead><tr><th>Employee</th><th>Basic</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr></thead>
                      <tbody>
                        {paged.map((r, i) => {
                          const emp = r.employee as { full_name: string; department: string } | undefined;
                          return (
                            <tr key={i}>
                              <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={emp?.full_name || ''} size="sm" /><div><div style={{ fontWeight: 600 }}>{emp?.full_name}</div><div style={{ fontSize: 12, color: 'var(--text-2)' }}>{emp?.department}</div></div></div></td>
                              <td>{formatCurrency(Number(r.basic_salary) || 0)}</td>
                              <td>{formatCurrency(Number(r.gross_earnings) || 0)}</td>
                              <td><span style={{ color: 'var(--danger)' }}>-{formatCurrency(Number(r.total_deductions) || 0)}</span></td>
                              <td><strong>{formatCurrency(Number(r.net_pay) || 0)}</strong></td>
                              <td><Badge status={String(r.status)} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </>
                  )}

                  {/* --- Attendance tab --- */}
                  {tab === 'attendance' && (
                    <>
                      <thead><tr><th>Employee</th><th>Date</th><th>Hours</th><th>Description</th><th>Status</th></tr></thead>
                      <tbody>
                        {paged.map((r, i) => {
                          const emp = r.employee as { full_name: string } | undefined;
                          return (
                            <tr key={i}>
                              <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={emp?.full_name || ''} size="sm" /><span style={{ fontWeight: 600 }}>{emp?.full_name}</span></div></td>
                              <td className="muted">{formatDate(String(r.entry_date))}</td>
                              <td><strong>{Number(r.total_hours)}h</strong></td>
                              <td className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r.task_description || '—')}</td>
                              <td><Badge status={String(r.status)} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </>
                  )}

                  {/* --- Leave tab --- */}
                  {tab === 'leave' && (
                    <>
                      <thead><tr><th>Employee</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead>
                      <tbody>
                        {paged.map((r, i) => {
                          const emp = r.employee as { full_name: string } | undefined;
                          return (
                            <tr key={i}>
                              <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={emp?.full_name || ''} size="sm" /><span style={{ fontWeight: 600 }}>{emp?.full_name}</span></div></td>
                              <td><Badge status={String(r.leave_type).split(' ')[0].toLowerCase()}>{String(r.leave_type)}</Badge></td>
                              <td className="muted">{formatDate(String(r.from_date))}</td>
                              <td className="muted">{formatDate(String(r.to_date))}</td>
                              <td><strong>{Number(r.total_days)}d</strong></td>
                              <td className="muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r.reason || '—')}</td>
                              <td><Badge status={String(r.status)} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </>
                  )}

                  {/* --- Employees tab --- */}
                  {tab === 'employees' && (
                    <>
                      <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Type</th><th>Salary</th><th>Joined</th><th>Status</th></tr></thead>
                      <tbody>
                        {paged.map((r, i) => (
                          <tr key={i}>
                            <td className="muted" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(r.employee_code || '—')}</td>
                            <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={String(r.full_name || '')} size="sm" /><span style={{ fontWeight: 600 }}>{String(r.full_name)}</span></div></td>
                            <td className="muted">{String(r.department || '—')}</td>
                            <td className="muted">{String(r.designation || '—')}</td>
                            <td><Badge status={String(r.emp_type)}>{String(r.emp_type)}</Badge></td>
                            <td><strong>{r.salary_type === 'hourly' ? `${formatCurrency(Number(r.hourly_rate) || 0)}/hr` : formatCurrency(Number(r.monthly_salary) || 0)}</strong></td>
                            <td className="muted">{formatDate(String(r.joining_date))}</td>
                            <td><Badge status={r.active ? 'active' : 'inactive'} dot /></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              </div>

              {/* Mobile cards */}
              <div className="report-cards">
                {paged.map((r, i) => {
                  const emp = r.employee as { full_name: string; department: string; employee_code: string } | undefined;
                  const name = emp?.full_name || String(r.full_name || '');
                  const dept = emp?.department || String(r.department || '');
                  const code = emp?.employee_code || String(r.employee_code || '');
                  if (tab === 'finance') {
                    const isE = String(r.type) === 'earning';
                    return (
                      <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{String(r.description)}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{formatDate(String(r.date))}</div>
                          </div>
                          <div style={{ fontWeight: 800, color: isE ? '#16A34A' : '#DC2626' }}>{isE ? '+' : '-'}{formatCurrency(Number(r.amount))}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px', fontSize: 12, color: 'var(--text-2)' }}>
                          <div><span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>{isE ? 'FROM' : 'TO'}</span>{String(isE ? r.received_from : r.paid_to) || '—'}</div>
                          {!isE && <div><span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>CATEGORY</span>{String(r.category || '—')}</div>}
                        </div>
                      </div>
                    );
                  }
                  if (tab === 'id_expiry') {
                    const sc = docStatusColor(String(r.status));
                    const days = daysUntilExpiry(r.expiry_date as string | undefined);
                    return (
                      <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={name} size="sm" />
                            <div><div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{code}</div></div>
                          </div>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 13 }}>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>TYPE</span>{DOC_TYPES[String(r.document_type)] || String(r.document_type)}</div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>NUMBER</span><span style={{ fontFamily: 'monospace' }}>{String(r.number)}</span></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>EXPIRY</span>{r.expiry_date ? formatDate(String(r.expiry_date)) : '—'}</div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>DAYS LEFT</span>{days === null ? '—' : <span style={{ fontWeight: 700, color: sc.color }}>{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</span>}</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={name} size="sm" />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{code}{dept ? ` · ${dept}` : ''}</div>
                          </div>
                        </div>
                        <Badge status={String(r.status || (r.active ? 'active' : 'inactive'))} dot />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                        {tab === 'payroll' && (<>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>NET PAY</span><div style={{ fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(Number(r.net_pay) || 0)}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>GROSS</span><div>{formatCurrency(Number(r.gross_earnings) || 0)}</div></div>
                        </>)}
                        {tab === 'attendance' && (<>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>DATE</span><div>{formatDate(String(r.entry_date))}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>HOURS</span><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{Number(r.total_hours)}h</div></div>
                        </>)}
                        {tab === 'leave' && (<>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>TYPE</span><div><Badge status={String(r.leave_type).split(' ')[0].toLowerCase()}>{String(r.leave_type)}</Badge></div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>DAYS</span><div style={{ fontWeight: 700 }}>{Number(r.total_days)}d</div></div>
                        </>)}
                        {tab === 'employees' && (<>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>DESIGNATION</span><div>{String(r.designation || '—')}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>TYPE</span><div><Badge status={String(r.emp_type)}>{String(r.emp_type)}</Badge></div></div>
                        </>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} label="records" />
        </div>
      </div>
    </>
  );
}
