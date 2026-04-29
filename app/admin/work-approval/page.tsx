'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { useUser } from '@/lib/hooks';
import { WorkEntry } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 10;

export default function WorkApprovalPage() {
  const { user } = useUser();
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [payrollMap, setPayrollMap] = useState<Record<string, { status: string; updated_at?: string }>>({});
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState<WorkEntry | null>(null);
  const [remark, setRemark] = useState('');
  const [adjHours, setAdjHours] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadCounts = useCallback(async () => {
    try {
      const [p, a, r] = await Promise.all([
        fetch('/api/work-entries?status=pending&limit=1').then(r => r.json()),
        fetch('/api/work-entries?status=approved&limit=1').then(r => r.json()),
        fetch('/api/work-entries?status=rejected&limit=1').then(r => r.json()),
      ]);
      setCounts({ pending: p.count || 0, approved: a.count || 0, rejected: r.count || 0 });
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/work-entries?status=${tab}&limit=200`);
      const json = await res.json();
      const loadedEntries: WorkEntry[] = json.data || [];
      setEntries(loadedEntries);

      // Build payroll status map keyed by "employeeId_YYYY-MM"
      const pairs = new Map<string, string>();
      for (const e of loadedEntries) {
        const month = e.entry_date?.slice(0, 7);
        if (e.employee_id && month) pairs.set(`${e.employee_id}_${month}`, month);
      }
      if (pairs.size > 0) {
        const months = [...new Set([...pairs.values()])];
        const results = await Promise.all(
          months.map(m => fetch(`/api/payroll?month=${m}`).then(r => r.json()))
        );
        const map: Record<string, { status: string; updated_at?: string }> = {};
        for (const result of results) {
          for (const p of (result.data || [])) {
            // Use created_at (when payroll was first generated) not updated_at (which changes on mark_paid)
            map[`${p.employee_id}_${p.payroll_month}`] = { status: p.status, updated_at: p.created_at };
          }
        }
        setPayrollMap(map);
      } else {
        setPayrollMap({});
      }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); loadCounts(); }, [load, loadCounts]);

  async function handleAction(id: string, status: 'approved' | 'rejected') {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/work-entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          admin_remark: remark,
          adjusted_hours: adjHours ? parseFloat(adjHours) : undefined,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success(`Entry ${status}`);
      setSelected(null);
      setRemark('');
      setAdjHours('');
      load();
      loadCounts();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    const emp = e.employee as { full_name: string; employee_code: string } | undefined;
    return emp?.full_name?.toLowerCase().includes(q) || emp?.employee_code?.toLowerCase().includes(q) || e.task_description?.toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Work Entry Approvals" user={user}
        actions={<Button variant="ghost" icon="📊" onClick={() => {
          const ws = (XLSX as typeof import('xlsx')).utils.json_to_sheet(entries.map(e => {
            const emp = e.employee as { full_name: string; employee_code: string } | undefined;
            return { Code: emp?.employee_code, Name: emp?.full_name, Date: e.entry_date, Hours: e.adjusted_hours || e.total_hours, Description: e.task_description, Status: e.status };
          }));
          const wb = (XLSX as typeof import('xlsx')).utils.book_new();
          (XLSX as typeof import('xlsx')).utils.book_append_sheet(wb, ws, 'Work Entries');
          (XLSX as typeof import('xlsx')).writeFile(wb, `work-entries-${tab}.xlsx`);
          toast.success('Excel exported');
        }}>Export Excel</Button>}
      />
      <div className="page-content">
        <Tabs
          tabs={[
            { key: 'pending',  label: 'Pending',  count: counts.pending },
            { key: 'approved', label: 'Approved', count: counts.approved },
            { key: 'rejected', label: 'Rejected', count: counts.rejected },
          ]}
          active={tab}
          onChange={t => { setTab(t); setSelected(null); setPage(1); }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-2)' }}>
              <input className="form-input" placeholder="Search by employee or description..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 340 }} />
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th>Date</th><th>Hours</th><th>Description</th><th>Payment</th><th>Proof</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                  ) : paged.length === 0 ? (
                    <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">✅</div><div>No {tab} entries</div></div></td></tr>
                  ) : paged.map(e => {
                    const emp = e.employee as { full_name: string; employee_code: string } | undefined;
                    const month = e.entry_date?.slice(0, 7);
                    const payInfo = month ? payrollMap[`${e.employee_id}_${month}`] : undefined;
                    // Entry is "new" if the work entry was created AFTER the payroll was generated
                    const isNewEntry = payInfo?.updated_at && e.created_at
                      ? new Date(e.created_at) > new Date(payInfo.updated_at)
                      : false;
                    return (
                      <tr key={e.id} style={{ background: selected?.id === e.id ? 'var(--primary-light)' : '' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={emp?.full_name || ''} size="sm" />
                            <div>
                              <div style={{ fontWeight: 600 }}>{emp?.full_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{emp?.employee_code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="muted">{formatDate(e.entry_date)}</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{e.adjusted_hours || e.total_hours}h</strong></td>
                        <td className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.task_description}</td>
                        <td>
                          {!payInfo
                            ? <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Not Generated</span>
                            : isNewEntry
                            ? <span style={{ fontSize: 12, color: 'var(--warning, #b45309)', fontWeight: 600 }}>⚠ New Entry</span>
                            : payInfo.status === 'paid'
                            ? <Badge status="active">✓ Paid</Badge>
                            : payInfo.status === 'generated'
                            ? <Badge status="pending">⏳ Unpaid</Badge>
                            : <Badge status="pending">📋 Draft</Badge>}
                        </td>
                        <td>
                          {e.proof_url
                            ? <a href={e.proof_url} target="_blank" rel="noreferrer"><Badge status="active">📎 File</Badge></a>
                            : <span style={{ color: 'var(--text-3)' }}>—</span>}
                        </td>
                        <td>
                          {tab === 'pending' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Button variant="success" size="xs" onClick={() => handleAction(e.id, 'approved')}>✓</Button>
                              <Button variant="danger"  size="xs" onClick={() => handleAction(e.id, 'rejected')}>✗</Button>
                              <Button variant="ghost"   size="xs" onClick={() => { setSelected(e); setRemark(e.admin_remark || ''); setAdjHours(String(e.adjusted_hours || e.total_hours)); }}>Detail</Button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Badge status={e.status} />
                              <Button variant="ghost" size="xs" onClick={() => setSelected(e)}>View</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} label="entries" />
          </div>

          {selected && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Review Entry</div>
                <button className="btn-icon" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{(selected.employee as { full_name: string })?.full_name}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 10 }}>{selected.task_description}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      ['Date', formatDate(selected.entry_date)],
                      ['Hours', `${selected.total_hours}h`],
                      ['Start', formatTime(selected.start_time)],
                      ['End', formatTime(selected.end_time)],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>{l}</div>
                        <div style={{ fontWeight: 600 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.proof_url && (
                  <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, textAlign: 'center', fontSize: 13 }}>
                    📎 Proof attached —{' '}
                    <a href={selected.proof_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>View File</a>
                  </div>
                )}

                {selected.admin_remark && tab !== 'pending' && (
                  <div className="alert alert-info">
                    <strong>Admin remark:</strong> {selected.admin_remark}
                  </div>
                )}

                {tab === 'pending' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Admin Remark <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
                      <textarea className="form-textarea" value={remark} onChange={e => setRemark(e.target.value)} placeholder="Add remark..." style={{ minHeight: 60 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Adjust Hours <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
                      <input className="form-input" type="number" step="0.5" min="0" value={adjHours} onChange={e => setAdjHours(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="success" style={{ flex: 1 }} loading={submitting} onClick={() => handleAction(selected.id, 'approved')}>✓ Approve</Button>
                      <Button variant="danger"  style={{ flex: 1 }} loading={submitting} onClick={() => handleAction(selected.id, 'rejected')}>✗ Reject</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
