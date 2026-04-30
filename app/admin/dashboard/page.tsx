'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useUser } from '@/lib/hooks';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { WorkEntry, LeaveRequest } from '@/types';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const [stats, setStats] = useState({ total: 0, permanent: 0, partTime: 0, pending: 0, pendingLeaves: 0, salaryTotal: 0, paid: 0 });
  const [financeStats, setFinanceStats] = useState({ todayEarnings: 0, todayExpenses: 0, monthEarnings: 0, monthExpenses: 0 });
  const [expiringCount, setExpiringCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [pendingWork, setPendingWork] = useState<WorkEntry[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [attendanceData, setAttendanceData] = useState([
    { name: 'Present', value: 0, color: '#3B6FE8' },
    { name: 'Leave',   value: 0, color: '#10B981' },
    { name: 'Absent',  value: 0, color: '#EF4444' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const now = new Date();
        const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const today = now.toISOString().slice(0, 10);
        const monthStart = `${curMonth}-01`;
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const monthEnd = `${curMonth}-${String(lastDay).padStart(2, '0')}`;
        const [empRes, workRes, leaveRes, payRes, chartRes, finEarnRes, finExpRes, finTodayEarnRes, finTodayExpRes, docsRes] = await Promise.all([
          fetch('/api/employees?limit=500'),
          fetch('/api/work-entries?status=pending&limit=5'),
          fetch('/api/leaves?status=pending&limit=1'),
          fetch(`/api/payroll?month=${curMonth}`),
          fetch('/api/reports?type=chart'),
          fetch(`/api/finance?type=earning&from=${monthStart}&to=${monthEnd}&limit=500`),
          fetch(`/api/finance?type=expense&from=${monthStart}&to=${monthEnd}&limit=500`),
          fetch(`/api/finance?type=earning&from=${today}&to=${today}&limit=500`),
          fetch(`/api/finance?type=expense&from=${today}&to=${today}&limit=500`),
          fetch('/api/documents?limit=500'),
        ]);

        const [empData, workData, leaveData, payData, chartJson, finEarnData, finExpData, finTodayEarnData, finTodayExpData, docsData] = await Promise.all([
          empRes.json(), workRes.json(), leaveRes.json(), payRes.json(), chartRes.json(),
          finEarnRes.json(), finExpRes.json(), finTodayEarnRes.json(), finTodayExpRes.json(), docsRes.json(),
        ]);

        const employees = empData.data || [];
        const payroll = payData.data || [];
        const perm = employees.filter((e: { emp_type: string }) => e.emp_type === 'permanent').length;
        const pt   = employees.filter((e: { emp_type: string }) => e.emp_type === 'part-time').length;

        setStats({
          total: empData.count || employees.length,
          permanent: perm,
          partTime: pt,
          pending: workData.count || 0,
          pendingLeaves: leaveData.count || 0,
          salaryTotal: payroll.reduce((s: number, p: { net_pay: number }) => s + (p.net_pay || 0), 0),
          paid: payroll.filter((p: { status: string }) => p.status === 'paid').length,
        });

        setPendingWork(workData.data || []);
        setPendingLeaves(leaveData.data?.slice(0, 3) || []);
        setChartData(chartJson.data || []);

        // Finance stats
        const monthEarnings = (finEarnData.data || []).reduce((s: number, e: { amount: number }) => s + Number(e.amount || 0), 0);
        const monthExpenses = (finExpData.data || []).reduce((s: number, e: { amount: number }) => s + Number(e.amount || 0), 0);
        const todayEarnings = (finTodayEarnData.data || []).reduce((s: number, e: { amount: number }) => s + Number(e.amount || 0), 0);
        const todayExpenses = (finTodayExpData.data || []).reduce((s: number, e: { amount: number }) => s + Number(e.amount || 0), 0);
        setFinanceStats({ todayEarnings, todayExpenses, monthEarnings, monthExpenses });

        // ID expiry counts
        const allDocs = docsData.data || [];
        setExpiringCount(allDocs.filter((d: { status: string }) => d.status === 'expiring').length);
        setExpiredCount(allDocs.filter((d: { status: string }) => d.status === 'expired').length);

        // Attendance: approved work entries this month vs total working days
        const [wApprRes, wAllRes, lApprRes] = await Promise.all([
          fetch(`/api/work-entries?status=approved&limit=500`).then(r => r.json()),
          fetch(`/api/work-entries?limit=1`).then(r => r.json()),
          fetch(`/api/leaves?status=approved&limit=500`).then(r => r.json()),
        ]);
        const totalEntries = (wApprRes.count || 0) + ((wAllRes.count || 0) - (wApprRes.count || 0));
        const approved = wApprRes.count || 0;
        const onLeave  = lApprRes.count || 0;
        const total3   = approved + onLeave + Math.max(0, totalEntries - approved);
        if (total3 > 0) {
          const presP = Math.round((approved / total3) * 100);
          const leaveP = Math.round((onLeave / total3) * 100);
          const absP = Math.max(0, 100 - presP - leaveP);
          setAttendanceData([
            { name: 'Present', value: presP, color: '#3B6FE8' },
            { name: 'Leave',   value: leaveP, color: '#10B981' },
            { name: 'Absent',  value: absP,  color: '#EF4444' },
          ]);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  async function quickApprove(id: string, action: 'approved' | 'rejected') {
    await fetch(`/api/work-entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action }),
    });
    setPendingWork(prev => prev.filter(e => e.id !== id));
    setStats(s => ({ ...s, pending: s.pending - 1 }));
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Dashboard" user={user} />
      <div className="page-content">
        {/* Stats row 1 */}
        <div className="stat-grid">
          <StatCard icon="👥" iconBg="#EEF3FD" label="Total Employees"  value={stats.total}     trend="active" trendDir="up" />
          <StatCard icon="🏢" iconBg="#ECFDF5" label="Permanent Staff"  value={stats.permanent} trend="full time" trendDir="up" />
          <StatCard icon="⏰" iconBg="#FFFBEB" label="Part-Time Staff"  value={stats.partTime}  trend="flexible" trendDir="up" />
          <StatCard icon="⚠️" iconBg="#FEF2F2" label="Pending Entries"  value={stats.pending}   trend="review needed" trendDir="down" />
        </div>

        {/* Stats row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <StatCard icon="🗓️" iconBg="#EEF2FF" label="Pending Leaves"    value={stats.pendingLeaves} />
          <StatCard icon="💰" iconBg="#ECFDF5" label="Salary This Month" value={formatCurrency(stats.salaryTotal)} trend="processed" trendDir="up" />
          <StatCard icon="✅" iconBg="#ECFDF5" label="Payments Completed" value={stats.paid} />
        </div>

        {/* Finance + ID widgets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <div className="card" style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => router.push('/admin/finance')}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Monthly Earnings</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A' }}>{formatCurrency(financeStats.monthEarnings)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>↗ {formatCurrency(financeStats.todayEarnings)} today</div>
          </div>
          <div className="card" style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => router.push('/admin/finance')}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Monthly Expenses</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>{formatCurrency(financeStats.monthExpenses)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>↗ {formatCurrency(financeStats.todayExpenses)} today</div>
          </div>
          <div className="card" style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => router.push('/admin/finance')}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Monthly Profit</div>
            {(() => {
              const pl = financeStats.monthEarnings - financeStats.monthExpenses;
              return <div style={{ fontSize: 22, fontWeight: 800, color: pl >= 0 ? '#16A34A' : '#DC2626' }}>{pl >= 0 ? '+' : ''}{formatCurrency(pl)}</div>;
            })()}
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Earnings − Expenses</div>
          </div>
          <div className="card" style={{ padding: '16px 20px', cursor: 'pointer', borderLeft: expiringCount > 0 || expiredCount > 0 ? '3px solid #F59E0B' : '3px solid #10B981' }} onClick={() => router.push('/admin/documents')}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>ID Expiry Alerts</div>
            {expiredCount > 0
              ? <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>{expiredCount} Expired</div>
              : expiringCount > 0
                ? <div style={{ fontSize: 22, fontWeight: 800, color: '#C2410C' }}>{expiringCount} Expiring</div>
                : <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A' }}>All OK</div>
            }
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{expiringCount} expiring in 30d</div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <Card title="Monthly Payroll Trend">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Payroll']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="rgba(59,111,232,0.25)">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === chartData.length - 1 ? '#3B6FE8' : 'rgba(59,111,232,0.25)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Attendance Overview">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <PieChart width={140} height={140}>
                <Pie data={attendanceData} cx={65} cy={65} innerRadius={42} outerRadius={60} dataKey="value" stroke="none">
                  {attendanceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <text x={70} y={60} textAnchor="middle" style={{ fontSize: 18, fontWeight: 800, fill: 'var(--text)' }}>{attendanceData[0].value}%</text>
                <text x={70} y={78} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-2)' }}>Present</text>
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                {attendanceData.map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-2)', flex: 1 }}>{s.name}</span>
                    <span style={{ fontWeight: 700 }}>{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Pending work approvals */}
        <Card
          title="Pending Work Approvals"
          actions={<Button variant="outline" size="sm" onClick={() => router.push('/admin/work-approval')}>View All →</Button>}
        >
          {loading ? (
            <div style={{ padding: 20, color: 'var(--text-2)', textAlign: 'center' }}>Loading...</div>
          ) : pendingWork.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><div>No pending entries</div></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th><th>Date</th><th>Hours</th><th>Description</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWork.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={(e.employee as { full_name: string })?.full_name || ''} size="sm" />
                          <span style={{ fontWeight: 600 }}>{(e.employee as { full_name: string })?.full_name}</span>
                        </div>
                      </td>
                      <td className="muted">{formatDate(e.entry_date)}</td>
                      <td><strong style={{ color: 'var(--primary)' }}>{e.total_hours}h</strong></td>
                      <td className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.task_description}</td>
                      <td><Badge status={e.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="success" size="xs" onClick={() => quickApprove(e.id, 'approved')}>✓</Button>
                          <Button variant="danger"  size="xs" onClick={() => quickApprove(e.id, 'rejected')}>✗</Button>
                          <Button variant="ghost"   size="xs" onClick={() => router.push('/admin/work-approval')}>Detail</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pending leaves quick view */}
        {pendingLeaves.length > 0 && (
          <Card
            title="Pending Leave Requests"
            actions={<Button variant="outline" size="sm" onClick={() => router.push('/admin/leave')}>View All →</Button>}
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Leave Type</th><th>Duration</th><th>Reason</th><th>Action</th></tr></thead>
                <tbody>
                  {pendingLeaves.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={(l.employee as { full_name: string })?.full_name || ''} size="sm" />
                          <span style={{ fontWeight: 600 }}>{(l.employee as { full_name: string })?.full_name}</span>
                        </div>
                      </td>
                      <td><Badge status={l.leave_type.split(' ')[0].toLowerCase()}>{l.leave_type}</Badge></td>
                      <td className="muted">{formatDate(l.from_date)} — {formatDate(l.to_date)} ({l.total_days}d)</td>
                      <td className="muted">{l.reason}</td>
                      <td><Button variant="outline" size="xs" onClick={() => router.push('/admin/leave')}>Review</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
