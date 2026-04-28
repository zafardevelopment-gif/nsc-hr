'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useUser } from '@/lib/hooks';
import { formatCurrency, formatDate } from '@/lib/utils';
import { WorkEntry, Payroll, LeaveBalance } from '@/types';

interface QuickAction {
  icon: string; label: string; sub: string; href: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: '📝', label: 'Submit Work Entry', sub: "Log today's hours",  href: '/employee/work-entry' },
  { icon: '🗓️', label: 'Apply for Leave',   sub: 'Request time off',   href: '/employee/leave' },
  { icon: '💰', label: 'View Payslip',       sub: 'View salary details', href: '/employee/payslip' },
  { icon: '🔔', label: 'Notifications',      sub: 'View alerts',         href: '/employee/notifications' },
];

export default function EmpDashboard() {
  const { user } = useUser();
  const router = useRouter();
  const [recentWork, setRecentWork] = useState<WorkEntry[]>([]);
  const [currentPayroll, setCurrentPayroll] = useState<Payroll | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      try {
        const [workRes, payRes, leaveRes] = await Promise.all([
          fetch('/api/work-entries?limit=5'),
          fetch(`/api/payroll?month=${month}`),
          fetch(`/api/leaves/balance?year=${now.getFullYear()}`),
        ]);
        const [workData, payData, leaveData] = await Promise.all([
          workRes.json(), payRes.json(), leaveRes.json(),
        ]);
        setRecentWork(workData.data || []);
        setCurrentPayroll(payData.data?.[0] || null);
        setLeaveBalances(leaveData.data || []);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [user]);

  if (!user) return null;

  const name = user.employee?.full_name || user.username;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const totalHours = recentWork.filter(e => e.status === 'approved').reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
  const approvedHours = recentWork.filter(e => e.status === 'approved').reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);

  const casualLeave = leaveBalances.find(l => l.leave_type === 'Casual Leave');
  const sickLeave = leaveBalances.find(l => l.leave_type === 'Sick Leave');

  return (
    <>
      <EmployeeTopbar title={`${greeting}, ${name.split(' ')[0]} 👋`} user={user} />
      <div className="page-content">
        {/* Welcome banner */}
        <div style={{ background: 'var(--sidebar-2)', borderRadius: 'var(--radius)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              {user.employee?.employee_code} · {user.employee?.department} · {user.employee?.designation}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {currentPayroll ? (
              <>
                <div style={{ color: 'var(--success)', fontSize: 24, fontWeight: 800 }}>{formatCurrency(currentPayroll.net_pay)}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  {new Date().toLocaleDateString('en-SA', { month: 'long', year: 'numeric' })} Salary
                </div>
                <Badge status={currentPayroll.status}>
                  {currentPayroll.status === 'paid' ? '✓ Paid' : currentPayroll.status === 'generated' ? '⏳ Pending' : '📋 Draft'}
                </Badge>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No payroll this month</div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid">
          <StatCard icon="🗓️" iconBg="#EEF3FD" label="Casual Leave Left"
            value={casualLeave ? casualLeave.total_days - casualLeave.used_days : 0}
            trend={casualLeave ? `${casualLeave.used_days} used` : ''} trendDir="up" />
          <StatCard icon="🤒" iconBg="#ECFDF5" label="Sick Leave Left"
            value={sickLeave ? sickLeave.total_days - sickLeave.used_days : 0}
            trend={sickLeave ? `${sickLeave.used_days} used` : ''} trendDir="up" />
          <StatCard icon="⏱️" iconBg="#FFFBEB" label="Approved Hours (Month)" value={`${approvedHours}h`} trend="approved" trendDir="up" />
          <StatCard icon="💰" iconBg="#ECFDF5" label="Salary Status"
            value={currentPayroll?.status === 'paid' ? 'Paid' : currentPayroll?.status === 'generated' ? 'Pending' : 'N/A'} />
        </div>

        {/* Quick actions + recent */}
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--dash-cols, 280px 1fr)', gap: 16 }} className="dash-grid">
          <Card title="Quick Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {QUICK_ACTIONS.map(a => (
                <div key={a.href}
                  onClick={() => router.push(a.href)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
                >
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{a.sub}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>›</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recent Activity" actions={<Button variant="ghost" size="sm" onClick={() => router.push('/employee/work-entry')}>View All</Button>}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
            ) : recentWork.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📝</div><div>No entries yet</div></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Hours</th><th>Description</th><th>Status</th></tr></thead>
                  <tbody>
                    {recentWork.map(e => (
                      <tr key={e.id}>
                        <td className="muted">{formatDate(e.entry_date)}</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{e.adjusted_hours || e.total_hours}h</strong></td>
                        <td className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.task_description}</td>
                        <td><Badge status={e.status} dot /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
