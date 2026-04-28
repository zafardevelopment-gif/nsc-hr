'use client';
import { useState, useEffect } from 'react';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { UploadZone } from '@/components/ui/UploadZone';
import { useUser } from '@/lib/hooks';
import { calcHours, formatDate, getMonthOptions } from '@/lib/utils';
import { WorkEntry } from '@/types';
import toast from 'react-hot-toast';

export default function WorkEntryPage() {
  const { user } = useUser();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime]     = useState('17:00');
  const [desc, setDesc]           = useState('');
  const [proofUrl, setProofUrl]   = useState('');
  const [proofName, setProofName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const hours = calcHours(startTime, endTime);
  const monthOptions = getMonthOptions();

  async function loadEntries() {
    try {
      const res = await fetch(`/api/work-entries?month=${selectedMonth}`);
      const json = await res.json();
      setEntries(json.data || []);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadEntries(); }, [selectedMonth]);

  async function submit() {
    if (!desc.trim()) { toast.error('Description is required'); return; }
    if (hours <= 0) { toast.error('End time must be after start time'); return; }

    setSubmitting(true);
    const tid = toast.loading('Submitting entry...');
    try {
      const res = await fetch('/api/work-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: entryDate,
          start_time: startTime,
          end_time: endTime,
          total_hours: hours,
          task_description: desc,
          proof_url: proofUrl || null,
          proof_filename: proofName || null,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success(json.message || 'Work entry submitted!', { id: tid });
      setDesc('');
      setProofUrl('');
      setProofName('');
      loadEntries();
    } catch (e: unknown) {
      toast.error((e as Error).message, { id: tid });
    } finally {
      setSubmitting(false);
    }
  }

  const approved = entries.filter(e => e.status === 'approved').reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
  const pending  = entries.filter(e => e.status === 'pending').reduce((s, e) => s + e.total_hours, 0);
  const [entrySearch, setEntrySearch] = useState('');
  const filteredEntries = entries.filter(e => !entrySearch || e.task_description?.toLowerCase().includes(entrySearch.toLowerCase()) || e.entry_date?.includes(entrySearch));

  if (!user) return null;

  return (
    <>
      <EmployeeTopbar title="Work Entry" user={user} />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Submit Form */}
          <Card title="Submit New Entry">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input className="form-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input className="form-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>

              {/* Hours display */}
              <div style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Total Hours Calculated</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: hours > 0 ? 'var(--primary)' : 'var(--danger)' }}>{hours > 0 ? `${hours}h` : '—'}</span>
              </div>

              <div className="form-group">
                <label className="form-label">Work Description *</label>
                <textarea className="form-textarea" placeholder="Describe the work done today..." value={desc} onChange={e => setDesc(e.target.value)} style={{ minHeight: 90 }} />
              </div>

              <div className="form-group">
                <label className="form-label">Upload Proof <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
                <UploadZone onUpload={(url, name) => { setProofUrl(url); setProofName(name); }} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="ghost" style={{ flex: 1 }} onClick={() => { setDesc(''); setProofUrl(''); setProofName(''); }}>Clear</Button>
                <Button style={{ flex: 2 }} loading={submitting} onClick={submit}>Submit Entry</Button>
              </div>
            </div>
          </Card>

          {/* My Entries */}
          <Card
            title={`My Entries`}
            actions={
              <select className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Summary */}
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase' }}>LOGGED</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{(approved + pending).toFixed(1)}h</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase' }}>APPROVED</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--success)' }}>{approved.toFixed(1)}h</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase' }}>PENDING</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--warning)' }}>{pending.toFixed(1)}h</div>
                </div>
              </div>

              <input className="form-input" placeholder="Search by date or description..." value={entrySearch} onChange={e => setEntrySearch(e.target.value)} style={{ marginBottom: 10 }} />
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}><div className="empty-icon">📝</div><div>No entries found</div></div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Date</th><th>Hours</th><th>Description</th><th>Status</th></tr></thead>
                    <tbody>
                      {filteredEntries.map(e => (
                        <tr key={e.id}>
                          <td className="muted">{formatDate(e.entry_date)}</td>
                          <td><strong style={{ color: 'var(--primary)' }}>{e.adjusted_hours || e.total_hours}h</strong></td>
                          <td className="muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.task_description}</td>
                          <td><Badge status={e.status} dot /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
