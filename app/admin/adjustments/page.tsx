'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useUser } from '@/lib/hooks';
import { Employee } from '@/types';
import { formatCurrency, getMonthOptions, getPayrollMonthLabel } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Adjustment {
  id: string;
  employee_id: string;
  adj_month: string;
  adj_type: 'bonus' | 'overtime' | 'allowance' | 'deduction' | 'advance';
  amount: number;
  reason?: string;
  applied: boolean;
  created_at?: string;
  employee?: { full_name: string; employee_code: string; department: string; emp_type: string };
}

const ADJ_TYPE_LABELS: Record<string, { label: string; color: string; sign: string }> = {
  bonus:     { label: 'Bonus',           color: 'var(--success)', sign: '+' },
  overtime:  { label: 'Overtime Pay',    color: 'var(--success)', sign: '+' },
  allowance: { label: 'Allowance',       color: 'var(--success)', sign: '+' },
  deduction: { label: 'Deduction',       color: 'var(--danger)',  sign: '−' },
  advance:   { label: 'Advance Recovery',color: 'var(--danger)',  sign: '−' },
};

export default function AdjustmentsPage() {
  const { user } = useUser();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Adjustment | null>(null);
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [empFilter, setEmpFilter] = useState('');

  const [form, setForm] = useState({
    employee_id: '',
    adj_month: (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })(),
    adj_type: 'bonus' as Adjustment['adj_type'],
    amount: '',
    reason: '',
  });

  // Searchable employee dropdown state
  const [empSearch, setEmpSearch] = useState('');
  const [empDropOpen, setEmpDropOpen] = useState(false);
  const empDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (empDropRef.current && !empDropRef.current.contains(e.target as Node)) {
        setEmpDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEmpOptions = employees.filter(e => {
    const q = empSearch.toLowerCase();
    return e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q) || (e.department || '').toLowerCase().includes(q);
  });

  const selectedEmpName = employees.find(e => e.id === form.employee_id)
    ? `${employees.find(e => e.id === form.employee_id)!.full_name} (${employees.find(e => e.id === form.employee_id)!.employee_code})`
    : '';

  const monthOptions = getMonthOptions();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: monthFilter });
      if (empFilter) params.set('empId', empFilter);
      const res = await fetch(`/api/adjustments?${params}`);
      const json = await res.json();
      setAdjustments(json.data || []);
    } catch { toast.error('Failed to load adjustments'); }
    finally { setLoading(false); }
  }, [monthFilter, empFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200&active=true')
      .then(r => r.json())
      .then(j => setEmployees(j.data || []))
      .catch(() => {});
  }, []);

  async function onSubmit() {
    if (!form.employee_id) { toast.error('Select an employee'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Adjustment added');
      setShowModal(false);
      setEmpSearch('');
      setEmpDropOpen(false);
      setForm(f => ({ ...f, employee_id: '', amount: '', reason: '', adj_type: 'bonus' }));
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally { setSubmitting(false); }
  }

  async function applyNow(adj: Adjustment) {
    const tid = toast.loading('Applying adjustment...');
    try {
      // Fetch payroll + ALL pending adjustments for this employee+month together
      const [payRes, allAdjRes] = await Promise.all([
        fetch(`/api/payroll?empId=${adj.employee_id}&month=${adj.adj_month}`).then(r => r.json()),
        fetch(`/api/adjustments?empId=${adj.employee_id}&month=${adj.adj_month}&applied=false`).then(r => r.json()),
      ]);
      const payroll = payRes.data?.[0];
      if (!payroll) {
        toast.error('No payroll found for this month. Generate payroll first.', { id: tid });
        return;
      }
      if (payroll.status === 'paid') {
        toast.error('Payroll already paid — cannot modify.', { id: tid });
        return;
      }

      // All pending adj IDs to mark applied
      const allPending: { id: string; adj_type: string; amount: number }[] = allAdjRes.data || [];
      const sum = (type: string) => allPending.filter(a => a.adj_type === type).reduce((s, a) => s + a.amount, 0);

      // Fetch ALL applied adjustments for this month to know what's already baked into payroll
      const appliedRes = await fetch(`/api/adjustments?empId=${adj.employee_id}&month=${adj.adj_month}&applied=true`).then(r => r.json());
      const applied: { adj_type: string; amount: number }[] = appliedRes.data || [];
      const appliedSum = (type: string) => applied.filter(a => a.adj_type === type).reduce((s, a) => s + a.amount, 0);

      // True base = current payroll value minus already-applied adjustments
      const baseOT      = (payroll.overtime_pay      || 0) - appliedSum('overtime');
      const baseBonus   = (payroll.bonus             || 0) - appliedSum('bonus');
      const baseAdvance = (payroll.advance_deduction || 0) - appliedSum('advance');

      // New value = base + all pending (including current adj)
      const body: Record<string, unknown> = {
        overtime_pay:      Math.max(0, baseOT)      + sum('overtime'),
        bonus:             Math.max(0, baseBonus)   + sum('bonus'),
        advance_deduction: Math.max(0, baseAdvance) + sum('advance'),
        adj_ids: allPending.map(a => a.id),
      };

      const res = await fetch(`/api/payroll/${payroll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Adjustment applied to payroll!', { id: tid });
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed', { id: tid });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/adjustments/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Adjustment deleted');
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  }

  // Summaries for current filtered list
  const pending = adjustments.filter(a => !a.applied);
  const totalAdditions = pending.filter(a => ['bonus','overtime','allowance'].includes(a.adj_type)).reduce((s, a) => s + a.amount, 0);
  const totalDeductions = pending.filter(a => ['deduction','advance'].includes(a.adj_type)).reduce((s, a) => s + a.amount, 0);

  if (!user) return null;

  return (
    <>
      <AdminTopbar
        title="Adjustments"
        user={user}
        actions={
          <Button icon="＋" onClick={() => setShowModal(true)}>Add Adjustment</Button>
        }
      />
      <div className="page-content">

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { l: 'Pending Entries', v: pending.length,                   color: 'var(--text-1)' },
            { l: '+ Additions',     v: formatCurrency(totalAdditions),   color: 'var(--success)' },
            { l: '− Deductions',    v: formatCurrency(totalDeductions),  color: 'var(--danger)'  },
          ].map(s => (
            <div key={s.l} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{s.l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto', minWidth: 180 }} value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Month</th><th>Type</th><th>Amount</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                ) : adjustments.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon">🧾</div>
                      <div>No adjustments for {getPayrollMonthLabel(monthFilter)}</div>
                      <div style={{ fontSize: 13 }}>Click "Add Adjustment" to create one</div>
                    </div>
                  </td></tr>
                ) : adjustments.map(a => {
                  const meta = ADJ_TYPE_LABELS[a.adj_type];
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={a.employee?.full_name || ''} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600 }}>{a.employee?.full_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{a.employee?.employee_code} · {a.employee?.department}</div>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{getPayrollMonthLabel(a.adj_month)}</td>
                      <td><span style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{meta.label}</span></td>
                      <td>
                        <strong style={{ color: meta.color, fontSize: 15 }}>
                          {meta.sign}{formatCurrency(a.amount)}
                        </strong>
                      </td>
                      <td className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.reason || '—'}
                      </td>
                      <td>
                        {a.applied
                          ? <Badge status="active">Applied</Badge>
                          : <Badge status="pending">Pending</Badge>
                        }
                      </td>
                      <td>
                        {!a.applied && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button variant="outline" size="xs" style={{ color: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => applyNow(a)}>Apply Now</Button>
                            <Button variant="ghost" size="xs" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(a)}>Delete</Button>
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

        {/* Add Adjustment Modal */}
        <Modal
          open={showModal}
          onClose={() => { setShowModal(false); setEmpSearch(''); setEmpDropOpen(false); }}
          title="Add Adjustment"
          maxWidth={520}
          footer={<>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button loading={submitting} onClick={onSubmit}>Save Adjustment</Button>
          </>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Employee + Month row — stacked when dropdown open to avoid overlap */}
            <div style={{ display: 'flex', flexDirection: empDropOpen ? 'column' : 'row', gap: 10 }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Employee *</label>
                <div ref={empDropRef} style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    placeholder="Search by name, code, department..."
                    value={empDropOpen ? empSearch : selectedEmpName}
                    onFocus={() => { setEmpDropOpen(true); setEmpSearch(''); }}
                    onChange={e => { setEmpSearch(e.target.value); setEmpDropOpen(true); }}
                    autoComplete="off"
                  />
                  {empDropOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
                      background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                      maxHeight: 200, overflowY: 'auto', marginTop: 4,
                    }}>
                      {filteredEmpOptions.length === 0 ? (
                        <div style={{ padding: '12px 14px', color: 'var(--text-2)', fontSize: 13 }}>No employees found</div>
                      ) : filteredEmpOptions.map(e => (
                        <div
                          key={e.id}
                          onMouseDown={() => {
                            setForm(f => ({ ...f, employee_id: e.id }));
                            setEmpSearch('');
                            setEmpDropOpen(false);
                          }}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                            background: form.employee_id === e.id ? 'var(--primary-light)' : 'transparent',
                            borderLeft: form.employee_id === e.id ? '3px solid var(--primary)' : '3px solid transparent',
                          }}
                          onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg)')}
                          onMouseLeave={ev => (ev.currentTarget.style.background = form.employee_id === e.id ? 'var(--primary-light)' : 'transparent')}
                        >
                          <Avatar name={e.full_name} size="sm" />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.full_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{e.employee_code} · {e.department}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Month *</label>
                <select className="form-select" value={form.adj_month} onChange={e => setForm(f => ({ ...f, adj_month: e.target.value }))}>
                  {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select className="form-select" value={form.adj_type} onChange={e => setForm(f => ({ ...f, adj_type: e.target.value as Adjustment['adj_type'] }))}>
                  <option value="bonus">Bonus</option>
                  <option value="overtime">Overtime Pay</option>
                  <option value="allowance">Allowance</option>
                  <option value="deduction">Deduction</option>
                  <option value="advance">Advance Recovery</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (SAR) *</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reason <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Eid bonus, advance recovery for month of March..."
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>

            {form.employee_id && form.amount && (
              <div style={{
                background: ['deduction','advance'].includes(form.adj_type) ? 'var(--danger-light, #fff0f0)' : 'var(--primary-light)',
                border: `1.5px solid ${['deduction','advance'].includes(form.adj_type) ? 'var(--danger)' : 'var(--primary)'}`,
                borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {ADJ_TYPE_LABELS[form.adj_type].label} for {employees.find(e => e.id === form.employee_id)?.full_name}
                </span>
                <strong style={{ fontSize: 18, color: ['deduction','advance'].includes(form.adj_type) ? 'var(--danger)' : 'var(--primary)' }}>
                  {ADJ_TYPE_LABELS[form.adj_type].sign}{formatCurrency(parseFloat(form.amount) || 0)}
                </strong>
              </div>
            )}
          </div>
        </Modal>

        {/* Delete Confirm */}
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Adjustment"
          footer={<>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </>}
        >
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>
            ⚠️ Delete this {deleteTarget && ADJ_TYPE_LABELS[deleteTarget.adj_type].label} of {deleteTarget && formatCurrency(deleteTarget.amount)} for {deleteTarget?.employee?.full_name}?
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
            This adjustment has not been applied to payroll yet. Deleting it will remove it permanently.
          </p>
        </Modal>
      </div>
    </>
  );
}
