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
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'payroll',    label: 'Payroll' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave',      label: 'Leave' },
  { key: 'employees',  label: 'Employees' },
];
const PAGE_SIZE = 15;

const chartData = [
  { name: 'Oct', value: 1240000 }, { name: 'Nov', value: 1380000 },
  { name: 'Dec', value: 1290000 }, { name: 'Jan', value: 1450000 },
  { name: 'Feb', value: 1380000 }, { name: 'Mar', value: 1520000 },
  { name: 'Apr', value: 1620000 },
];

export default function ReportsPage() {
  const { user } = useUser();
  const [tab, setTab] = useState('payroll');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const monthOptions = getMonthOptions();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setPage(1);
      try {
        const res = await fetch(`/api/reports?type=${tab}&month=${month}`);
        const json = await res.json();
        setData(json.data || []);
      } catch { toast.error('Failed to load report'); }
      finally { setLoading(false); }
    }
    load();
  }, [tab, month]);

  const filtered = data.filter(row => {
    if (!search) return true;
    const q = search.toLowerCase();
    const emp = row.employee as Record<string, unknown> | undefined;
    return String(emp?.full_name || '').toLowerCase().includes(q)
      || String(emp?.employee_code || '').toLowerCase().includes(q)
      || String(emp?.department || row.department || '').toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(data.map(row => {
      const emp = row.employee as Record<string, unknown> | undefined;
      if (tab === 'payroll')    return { Code: emp?.employee_code, Name: emp?.full_name, Dept: emp?.department, Basic: row.basic_salary, Gross: row.gross_earnings, Deductions: row.total_deductions, 'Net Pay': row.net_pay, Status: row.status };
      if (tab === 'attendance') return { Code: emp?.employee_code, Name: emp?.full_name, Date: row.entry_date, Hours: row.total_hours, Description: row.task_description, Status: row.status };
      if (tab === 'leave')      return { Code: emp?.employee_code, Name: emp?.full_name, 'Leave Type': row.leave_type, From: row.from_date, To: row.to_date, Days: row.total_days, Reason: row.reason, Status: row.status };
      return { Code: row.employee_code, Name: row.full_name, Department: row.department, Designation: row.designation, Type: row.emp_type, 'Salary Type': row.salary_type, 'Monthly Salary': row.monthly_salary, 'Hourly Rate': row.hourly_rate, Joined: row.joining_date, Status: row.active ? 'Active' : 'Inactive' };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab);
    XLSX.writeFile(wb, `nsc-hr-${tab}-${month}.xlsx`);
    toast.success('Excel exported');
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Reports & Analytics" user={user} />
      <div className="page-content">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input className="form-input" placeholder="Search employee..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 140, maxWidth: 260 }} />
          <Button variant="ghost" icon="📊" onClick={exportExcel} size="sm">Export Excel</Button>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setSearch(''); setPage(1); }} />

        {/* Charts — hidden on mobile to save space */}
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
              <PieChart width={140} height={140}>
                <Pie data={[{ name: 'Permanent', value: 70 }, { name: 'Part-Time', value: 30 }]} cx={65} cy={65} innerRadius={42} outerRadius={60} dataKey="value" stroke="none">
                  <Cell fill="#3B6FE8" /><Cell fill="#F59E0B" />
                </Pie>
                <text x={70} y={60} textAnchor="middle" style={{ fontSize: 18, fontWeight: 800, fill: 'var(--text)' }}>70%</text>
                <text x={70} y={78} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-2)' }}>Permanent</text>
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {[{ label: 'Permanent', color: '#3B6FE8', val: '70%' }, { label: 'Part-Time', color: '#F59E0B', val: '30%' }].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                    <span style={{ color: 'var(--text-2)', flex: 1 }}>{s.label}</span>
                    <span style={{ fontWeight: 700 }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Data Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <div className="card-title">{tab === 'payroll' ? 'Payroll Report' : tab === 'attendance' ? 'Attendance Report' : tab === 'leave' ? 'Leave Report' : 'Employee Directory'}</div>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{filtered.length} records</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
          ) : paged.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}><div className="empty-icon">📊</div><div>No data found</div></div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="report-table-wrap table-wrap">
                <table className="data-table">
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
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>GROSS</span><div style={{ fontWeight: 600 }}>{formatCurrency(Number(r.gross_earnings) || 0)}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>BASIC</span><div>{formatCurrency(Number(r.basic_salary) || 0)}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>DEDUCTIONS</span><div style={{ color: 'var(--danger)' }}>-{formatCurrency(Number(r.total_deductions) || 0)}</div></div>
                        </>)}
                        {tab === 'attendance' && (<>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>DATE</span><div>{formatDate(String(r.entry_date))}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>HOURS</span><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{Number(r.total_hours)}h</div></div>
                          <div style={{ gridColumn: '1/-1' }}><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>DESCRIPTION</span><div style={{ color: 'var(--text-2)', fontSize: 13 }}>{String(r.task_description || '—')}</div></div>
                        </>)}
                        {tab === 'leave' && (<>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>TYPE</span><div><Badge status={String(r.leave_type).split(' ')[0].toLowerCase()}>{String(r.leave_type)}</Badge></div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>DAYS</span><div style={{ fontWeight: 700 }}>{Number(r.total_days)}d</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>FROM</span><div>{formatDate(String(r.from_date))}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>TO</span><div>{formatDate(String(r.to_date))}</div></div>
                        </>)}
                        {tab === 'employees' && (<>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>DESIGNATION</span><div>{String(r.designation || '—')}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>TYPE</span><div><Badge status={String(r.emp_type)}>{String(r.emp_type)}</Badge></div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>SALARY</span><div style={{ fontWeight: 700 }}>{r.salary_type === 'hourly' ? `${formatCurrency(Number(r.hourly_rate) || 0)}/hr` : formatCurrency(Number(r.monthly_salary) || 0)}</div></div>
                          <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>JOINED</span><div>{formatDate(String(r.joining_date))}</div></div>
                        </>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {totalPages > 1 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-2)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Page {page} of {totalPages}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`pagination-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
