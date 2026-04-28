'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { useUser } from '@/lib/hooks';
import { WorkEntry } from '@/types';
import { formatDate, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function WorkApprovalPage() {
  const { user } = useUser();
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState<WorkEntry | null>(null);
  const [remark, setRemark] = useState('');
  const [adjHours, setAdjHours] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/work-entries?status=${tab}`);
      const json = await res.json();
      setEntries(json.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

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
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const counts = {
    pending: entries.filter(e => e.status === 'pending').length,
    approved: entries.filter(e => e.status === 'approved').length,
    rejected: entries.filter(e => e.status === 'rejected').length,
  };

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Work Entry Approvals" user={user}
        actions={<Button variant="ghost" icon="📊">Export</Button>}
      />
      <div className="page-content">
        <Tabs
          tabs={[
            { key: 'pending',  label: 'Pending',  count: counts.pending },
            { key: 'approved', label: 'Approved', count: counts.approved },
            { key: 'rejected', label: 'Rejected', count: counts.rejected },
          ]}
          active={tab}
          onChange={t => { setTab(t); setSelected(null); }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th>Date</th><th>Hours</th><th>Description</th><th>Proof</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">✅</div><div>No {tab} entries</div></div></td></tr>
                  ) : entries.map(e => {
                    const emp = e.employee as { full_name: string; employee_code: string } | undefined;
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
