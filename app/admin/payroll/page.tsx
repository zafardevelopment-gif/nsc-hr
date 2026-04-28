'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useUser } from '@/lib/hooks';
import { Payroll } from '@/types';
import { formatCurrency, getMonthOptions, getPayrollMonthLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function PayrollPage() {
  const { user } = useUser();
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [selectedPay, setSelectedPay] = useState<Payroll | null>(null);
  const [payForm, setPayForm] = useState({ method: 'Bank Transfer', ref: '', date: new Date().toISOString().split('T')[0], notes: '', bank_last4: '' });
  const [adjForm, setAdjForm] = useState({ overtime_pay: '', bonus: '', other_allowance: '', advance_deduction: '', other_deductions: '', payment_notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const monthOptions = getMonthOptions();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll?month=${month}`);
      const json = await res.json();
      setPayroll(json.data || []);
    } catch { toast.error('Failed to load payroll'); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  async function generateAll() {
    setGenerating(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success(json.message);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function markPaid() {
    if (!selectedPay) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payroll/${selectedPay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', ...payForm, payment_method: payForm.method }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Payment marked');
      setShowPayModal(false);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAdjustment() {
    if (!selectedPay) return;
    setSubmitting(true);
    try {
      const body: Record<string, number | string> = {};
      if (adjForm.overtime_pay !== '')    body.overtime_pay = parseFloat(adjForm.overtime_pay) || 0;
      if (adjForm.bonus !== '')           body.bonus = parseFloat(adjForm.bonus) || 0;
      if (adjForm.other_allowance !== '') body.other_allowance = parseFloat(adjForm.other_allowance) || 0;
      if (adjForm.advance_deduction !== '') body.advance_deduction = parseFloat(adjForm.advance_deduction) || 0;
      if (adjForm.other_deductions !== '') body.other_deductions = parseFloat(adjForm.other_deductions) || 0;
      if (adjForm.payment_notes !== '')   body.payment_notes = adjForm.payment_notes;

      const res = await fetch(`/api/payroll/${selectedPay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Payroll adjusted successfully');
      setShowAdjModal(false);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally { setSubmitting(false); }
  }

  const total = payroll.reduce((s, p) => s + (p.net_pay || 0), 0);
  const paid = payroll.filter(p => p.status === 'paid').length;

  const filtered = payroll.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    const emp = p.employee as { full_name: string; department: string; employee_code: string } | undefined;
    return emp?.full_name?.toLowerCase().includes(q) || emp?.department?.toLowerCase().includes(q) || emp?.employee_code?.toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(payroll.map(p => {
      const emp = p.employee as { full_name: string; department: string; employee_code: string; emp_type: string } | undefined;
      return { Code: emp?.employee_code, Name: emp?.full_name, Department: emp?.department, Type: emp?.emp_type, 'Basic Salary': p.basic_salary, Overtime: p.overtime_pay, Bonus: p.bonus, 'Total Deductions': p.total_deductions, 'Net Pay': p.net_pay, Status: p.status };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    XLSX.writeFile(wb, `payroll-${month}.xlsx`);
    toast.success('Excel exported');
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar
        title={`Payroll — ${getPayrollMonthLabel(month)}`}
        user={user}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" icon="📊" onClick={exportExcel}>Export Excel</Button>
            <Button icon="⚡" loading={generating} onClick={generateAll}>Auto-Generate All</Button>
          </div>
        }
      />
      <div className="page-content">
        {/* Summary banner */}
        <div style={{ background: 'var(--sidebar-2)', borderRadius: 'var(--radius)', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
          {[
            { l: 'Total Payroll', v: formatCurrency(total) },
            { l: 'Employees',     v: payroll.length },
            { l: 'Paid',          v: paid },
            { l: 'Pending',       v: payroll.length - paid },
          ].map(s => (
            <div key={s.l}>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 4 }}>{s.l}</div>
              <div style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 'auto' }} value={month} onChange={e => { setMonth(e.target.value); setPage(1); }}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input className="form-input" placeholder="Search employee..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 220 }} />
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Base</th><th>OT</th><th>Bonus</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon">💰</div><div>No payroll generated for this month</div><div style={{ fontSize: 13 }}>Click "Auto-Generate All" to create payroll</div></div></td></tr>
                ) : paged.map(p => {
                  const emp = p.employee as { full_name: string; emp_type: string; department: string } | undefined;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={emp?.full_name || ''} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600 }}>{emp?.full_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{emp?.emp_type} · {emp?.department}</div>
                          </div>
                        </div>
                      </td>
                      <td>{p.basic_salary ? formatCurrency(p.basic_salary) : <span style={{ color: 'var(--text-3)' }}>Hourly</span>}</td>
                      <td>{p.overtime_pay ? <span style={{ color: 'var(--success)' }}>+{formatCurrency(p.overtime_pay)}</span> : '—'}</td>
                      <td>{p.bonus ? <span style={{ color: 'var(--success)' }}>+{formatCurrency(p.bonus)}</span> : '—'}</td>
                      <td>{p.total_deductions ? <span style={{ color: 'var(--danger)' }}>-{formatCurrency(p.total_deductions)}</span> : '—'}</td>
                      <td><strong style={{ fontSize: 15 }}>{formatCurrency(p.net_pay)}</strong></td>
                      <td><Badge status={p.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {p.status !== 'paid' && (
                            <Button variant="outline" size="xs" onClick={() => {
                              setSelectedPay(p);
                              setAdjForm({
                                overtime_pay: p.overtime_pay ? String(p.overtime_pay) : '',
                                bonus: p.bonus ? String(p.bonus) : '',
                                other_allowance: p.other_allowance ? String(p.other_allowance) : '',
                                advance_deduction: p.advance_deduction ? String(p.advance_deduction) : '',
                                other_deductions: p.other_deductions ? String(p.other_deductions) : '',
                                payment_notes: p.payment_notes || '',
                              });
                              setShowAdjModal(true);
                            }}>Adjust</Button>
                          )}
                          {p.status !== 'paid' && (
                            <Button variant="success" size="xs" onClick={() => { setSelectedPay(p); setShowPayModal(true); }}>Mark Paid</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-2)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{filtered.length} records</span>
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

        {/* Adjust Payroll Modal */}
        <Modal open={showAdjModal} onClose={() => setShowAdjModal(false)} title="Adjust Payroll"
          maxWidth={520}
          footer={<>
            <Button variant="ghost" onClick={() => setShowAdjModal(false)}>Cancel</Button>
            <Button loading={submitting} onClick={saveAdjustment}>Save Adjustments</Button>
          </>}
        >
          {selectedPay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="alert alert-info">
                Adjusting payroll for <strong>{(selectedPay.employee as { full_name: string })?.full_name}</strong> — {selectedPay.payroll_month}
              </div>

              {/* Base info */}
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>BASIC</div><div style={{ fontWeight: 700 }}>{formatCurrency(selectedPay.basic_salary || 0)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>CURRENT NET</div><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(selectedPay.net_pay || 0)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>STATUS</div><div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{selectedPay.status}</div></div>
              </div>

              {/* Additions */}
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--success)', marginBottom: -6 }}>+ Additions</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Overtime Pay</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={adjForm.overtime_pay} onChange={e => setAdjForm(f => ({ ...f, overtime_pay: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bonus / Incentive</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={adjForm.bonus} onChange={e => setAdjForm(f => ({ ...f, bonus: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Other Allowance</label>
                <input className="form-input" type="number" min="0" placeholder="0" value={adjForm.other_allowance} onChange={e => setAdjForm(f => ({ ...f, other_allowance: e.target.value }))} />
              </div>

              {/* Deductions */}
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger)', marginBottom: -6 }}>− Deductions</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Advance Deduction</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={adjForm.advance_deduction} onChange={e => setAdjForm(f => ({ ...f, advance_deduction: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Other Deductions</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={adjForm.other_deductions} onChange={e => setAdjForm(f => ({ ...f, other_deductions: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
                <textarea className="form-textarea" rows={2} placeholder="e.g. Eid bonus, advance recovery..." value={adjForm.payment_notes} onChange={e => setAdjForm(f => ({ ...f, payment_notes: e.target.value }))} />
              </div>

              {/* Live preview */}
              {(() => {
                const ot = parseFloat(adjForm.overtime_pay) || selectedPay.overtime_pay || 0;
                const bonus = parseFloat(adjForm.bonus) || selectedPay.bonus || 0;
                const oa = parseFloat(adjForm.other_allowance) || selectedPay.other_allowance || 0;
                const adv = parseFloat(adjForm.advance_deduction) || selectedPay.advance_deduction || 0;
                const od = parseFloat(adjForm.other_deductions) || selectedPay.other_deductions || 0;
                const gross = (selectedPay.basic_salary || 0) + (selectedPay.hra || 0) + (selectedPay.conveyance || 0) + ot + bonus + oa;
                const ded = (selectedPay.pf_employee || 0) + (selectedPay.professional_tax || 0) + adv + od;
                const net = gross - ded;
                return (
                  <div style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Estimated Net Pay</span>
                    <strong style={{ fontSize: 20, color: 'var(--primary)' }}>{formatCurrency(net)}</strong>
                  </div>
                );
              })()}
            </div>
          )}
        </Modal>

        {/* Mark Paid Modal */}
        <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title="Confirm Payment"
          footer={<>
            <Button variant="ghost" onClick={() => setShowPayModal(false)}>Cancel</Button>
            <Button variant="success" loading={submitting} onClick={markPaid}>✓ Confirm Payment</Button>
          </>}
        >
          {selectedPay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="alert alert-info">
                Marking payment for {(selectedPay.employee as { full_name: string })?.full_name}
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
                  <option>Bank Transfer</option><option>Cash</option><option>UPI</option><option>Cheque</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transaction Reference No.</label>
                <input className="form-input" placeholder="TXN / UTR number" value={payForm.ref} onChange={e => setPayForm(f => ({ ...f, ref: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input className="form-input" type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Last 4 Digits</label>
                  <input className="form-input" placeholder="4231" maxLength={4} value={payForm.bank_last4} onChange={e => setPayForm(f => ({ ...f, bank_last4: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Remarks <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
                <textarea className="form-textarea" placeholder="Any notes..." value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 60 }} />
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-2)' }}>Net Amount</span>
                <strong style={{ fontSize: 18 }}>{formatCurrency(selectedPay.net_pay)}</strong>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}
