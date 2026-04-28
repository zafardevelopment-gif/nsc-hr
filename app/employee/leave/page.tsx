'use client';
import { useState, useEffect } from 'react';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { useUser } from '@/lib/hooks';
import { calcLeaveDays, formatDate } from '@/lib/utils';
import { LeaveBalance, LeaveRequest } from '@/types';
import toast from 'react-hot-toast';

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Emergency Leave'];
const LEAVE_COLORS: Record<string, string> = {
  'Casual Leave':    'var(--primary)',
  'Sick Leave':      'var(--success)',
  'Emergency Leave': 'var(--danger)',
};

export default function LeaveApplyPage() {
  const { user } = useUser();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'Casual Leave', from: '', to: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const days = form.from && form.to ? calcLeaveDays(form.from, form.to) : 0;

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [balRes, histRes] = await Promise.all([
          fetch(`/api/leaves/balance?year=${new Date().getFullYear()}`),
          fetch('/api/leaves'),
        ]);
        const [balData, histData] = await Promise.all([balRes.json(), histRes.json()]);
        setBalances(balData.data || []);
        setHistory(histData.data || []);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [user]);

  async function submit() {
    if (!form.from || !form.to || !form.reason.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    if (new Date(form.to) < new Date(form.from)) {
      toast.error('End date must be after start date');
      return;
    }
    setSubmitting(true);
    const tid = toast.loading('Submitting leave request...');
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_type: form.type, from_date: form.from, to_date: form.to, total_days: days, reason: form.reason }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Leave request submitted!', { id: tid });
      setForm(f => ({ ...f, from: '', to: '', reason: '' }));

      const [balRes, histRes] = await Promise.all([
        fetch(`/api/leaves/balance?year=${new Date().getFullYear()}`),
        fetch('/api/leaves'),
      ]);
      const [balData, histData] = await Promise.all([balRes.json(), histRes.json()]);
      setBalances(balData.data || []);
      setHistory(histData.data || []);
    } catch (e: unknown) {
      toast.error((e as Error).message, { id: tid });
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <EmployeeTopbar title="Leave Management" user={user} />
      <div className="page-content">
        {/* Balance cards */}
        <div className="leave-cards">
          {loading ? (
            LEAVE_TYPES.map(t => (
              <div key={t} className="leave-card">
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{t}</div>
                <div className="skeleton" style={{ height: 28, width: 60, marginBottom: 8 }} />
                <div className="progress-bar"><div className="progress-fill" style={{ width: '0%' }} /></div>
              </div>
            ))
          ) : balances.length > 0 ? (
            balances.map(b => (
              <div key={b.leave_type} className="leave-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{b.leave_type}</div>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{b.used_days}/{b.total_days} used</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
                  {b.total_days - b.used_days}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginLeft: 6 }}>days remaining</span>
                </div>
                <Progress value={b.used_days} max={b.total_days} color={LEAVE_COLORS[b.leave_type] || 'var(--primary)'} />
              </div>
            ))
          ) : LEAVE_TYPES.map(t => (
            <div key={t} className="leave-card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{t}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-3)' }}>—</div>
              <Progress value={0} max={1} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Apply form */}
          <Card title="Apply for Leave">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input className="form-input" type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input className="form-input" type="date" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} min={form.from || new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              {days > 0 && (
                <div style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Duration</span>
                  <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 18 }}>{days} day{days !== 1 ? 's' : ''}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="form-textarea" placeholder="Please describe your reason..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
              </div>

              <Button loading={submitting} onClick={submit}>Submit Leave Request</Button>
            </div>
          </Card>

          {/* Leave history */}
          <Card title="My Leave History">
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
            ) : history.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🗓️</div><div>No leave history</div></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr></thead>
                  <tbody>
                    {history.map(l => (
                      <tr key={l.id}>
                        <td><Badge status={l.leave_type.split(' ')[0].toLowerCase()}>{l.leave_type}</Badge></td>
                        <td className="muted">{formatDate(l.from_date)}</td>
                        <td className="muted">{formatDate(l.to_date)}</td>
                        <td><strong>{l.total_days}d</strong></td>
                        <td><Badge status={l.status} dot /></td>
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
