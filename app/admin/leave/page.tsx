'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { useUser } from '@/lib/hooks';
import { LeaveRequest } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function LeaveApprovalPage() {
  const { user } = useUser();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [remark, setRemark] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const loadCounts = useCallback(async () => {
    try {
      const [p, a, r] = await Promise.all([
        fetch('/api/leaves?status=pending&limit=1').then(r => r.json()),
        fetch('/api/leaves?status=approved&limit=1').then(r => r.json()),
        fetch('/api/leaves?status=rejected&limit=1').then(r => r.json()),
      ]);
      setCounts({ pending: p.count || 0, approved: a.count || 0, rejected: r.count || 0 });
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaves?status=${tab}&limit=200`);
      const json = await res.json();
      setLeaves(json.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); loadCounts(); }, [load, loadCounts]);

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
      loadCounts();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  }

  const filtered = leaves.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    const emp = l.employee as { full_name: string } | undefined;
    return emp?.full_name?.toLowerCase().includes(q) || l.leave_type?.toLowerCase().includes(q) || l.reason?.toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(leaves.map(l => {
      const emp = l.employee as { full_name: string; employee_code: string } | undefined;
      return { Code: emp?.employee_code, Name: emp?.full_name, 'Leave Type': l.leave_type, From: l.from_date, To: l.to_date, Days: l.total_days, Reason: l.reason, Status: l.status };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leave Requests');
    XLSX.writeFile(wb, `leave-${tab}.xlsx`);
    toast.success('Excel exported');
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Leave Management" user={user}
        actions={<Button variant="ghost" icon="📊" onClick={exportExcel}>Export Excel</Button>}
      />
      <div className="page-content">
        <Tabs
          tabs={[
            { key: 'pending',  label: 'Pending',  count: counts.pending },
            { key: 'approved', label: 'Approved', count: counts.approved },
            { key: 'rejected', label: 'Rejected', count: counts.rejected },
          ]}
          active={tab}
          onChange={t => { setTab(t); setPage(1); }}
        />

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-2)' }}>
            <input className="form-input" placeholder="Search by employee, leave type, reason..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 380 }} />
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Action</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🗓️</div><div>No {tab} leave requests</div></div></td></tr>
                ) : paged.map(l => {
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
          <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} label="requests" />
        </div>
      </div>
    </>
  );
}
