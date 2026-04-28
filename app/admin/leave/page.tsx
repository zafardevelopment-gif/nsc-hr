'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { Progress } from '@/components/ui/Progress';
import { useUser } from '@/lib/hooks';
import { LeaveRequest } from '@/types';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const LEAVE_SUMMARY = [
  { type: 'Casual Leave',    total: 12, used: 3,  color: 'var(--primary)' },
  { type: 'Sick Leave',      total: 6,  used: 1,  color: 'var(--success)' },
  { type: 'Emergency Leave', total: 3,  used: 0,  color: 'var(--danger)' },
];

export default function LeaveApprovalPage() {
  const { user } = useUser();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [remark, setRemark] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaves?status=${tab}`);
      const json = await res.json();
      setLeaves(json.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, status: 'approved' | 'rejected') {
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_remark: remark[id] || '' }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success(`Leave ${status}`);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Leave Management" user={user} />
      <div className="page-content">
        {/* Leave balance overview cards */}
        <div className="leave-cards">
          {LEAVE_SUMMARY.map(b => (
            <div key={b.type} className="leave-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.type}</div>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{b.used}/{b.total}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
                {b.total - b.used}
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginLeft: 6 }}>remaining</span>
              </div>
              <Progress value={b.used} max={b.total} color={b.color} />
            </div>
          ))}
        </div>

        <Tabs
          tabs={[
            { key: 'pending',  label: 'Pending',  count: leaves.filter(l => l.status === 'pending').length },
            { key: 'approved', label: 'Approved', count: leaves.filter(l => l.status === 'approved').length },
            { key: 'rejected', label: 'Rejected', count: leaves.filter(l => l.status === 'rejected').length },
          ]}
          active={tab}
          onChange={setTab}
        />

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Action</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                ) : leaves.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🗓️</div><div>No {tab} leave requests</div></div></td></tr>
                ) : leaves.map(l => {
                  const emp = l.employee as { full_name: string } | undefined;
                  return (
                    <tr key={l.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={emp?.full_name || ''} size="sm" />
                          <span style={{ fontWeight: 600 }}>{emp?.full_name}</span>
                        </div>
                      </td>
                      <td>
                        <Badge status={l.leave_type.split(' ')[0].toLowerCase()}>{l.leave_type}</Badge>
                      </td>
                      <td className="muted">{formatDate(l.from_date)}</td>
                      <td className="muted">{formatDate(l.to_date)}</td>
                      <td><strong>{l.total_days}d</strong></td>
                      <td className="muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason || '—'}</td>
                      <td>
                        {tab === 'pending' ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Button variant="success" size="xs" onClick={() => act(l.id, 'approved')}>✓ Approve</Button>
                            <Button variant="danger"  size="xs" onClick={() => act(l.id, 'rejected')}>✗ Reject</Button>
                          </div>
                        ) : (
                          <Badge status={l.status} dot />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
