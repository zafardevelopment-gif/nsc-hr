'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { useUser } from '@/lib/hooks';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FinanceEntry, Project } from '@/types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const TABS = [
  { key: 'earning', label: 'Earnings (Credit)' },
  { key: 'expense', label: 'Expenses (Debit)' },
];

const EXPENSE_CATEGORIES = [
  'Salaries', 'Office Supplies', 'Utilities', 'Rent', 'Travel',
  'Maintenance', 'IT & Software', 'Marketing', 'Food & Beverage',
  'Transportation', 'Insurance', 'Legal & Compliance', 'Miscellaneous',
];

const PAYMENT_MODES = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'online',        label: 'Online' },
  { value: 'other',         label: 'Other' },
];

const PAGE_SIZE = 15;

const EMPTY_EARNING = { type: 'earning', date: new Date().toISOString().slice(0, 10), description: '', amount: '', received_from: '', payment_mode: '', reference: '', notes: '', project_id: '' };
const EMPTY_EXPENSE = { type: 'expense', date: new Date().toISOString().slice(0, 10), description: '', amount: '', paid_to: '', category: '', payment_mode: '', notes: '', project_id: '' };

export default function FinancePage() {
  const { user } = useUser();
  const [tab, setTab]             = useState<'earning' | 'expense'>('earning');
  const [entries, setEntries]     = useState<FinanceEntry[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<FinanceEntry | null>(null);
  const [form, setForm]           = useState<Record<string, string>>({ ...EMPTY_EARNING });
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/finance?type=${tab}&limit=500`;
      if (from)          url += `&from=${from}`;
      if (to)            url += `&to=${to}`;
      if (projectFilter) url += `&project_id=${projectFilter}`;
      const res = await fetch(url);
      const json = await res.json();
      setEntries(json.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab, from, to, projectFilter]);

  useEffect(() => { load(); setPage(1); }, [load]);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data || [])).catch(() => {});
  }, []);

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.description.toLowerCase().includes(q) ||
      (e.received_from || '').toLowerCase().includes(q) ||
      (e.paid_to || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      (e.reference || '').toLowerCase().includes(q) ||
      (e.project?.project_name || '').toLowerCase().includes(q)
    );
  });
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paged       = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalAmount = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);

  function openAdd() {
    setEditEntry(null);
    setForm(tab === 'earning' ? { ...EMPTY_EARNING } : { ...EMPTY_EXPENSE, type: 'expense' });
    setModalOpen(true);
  }

  function openEdit(entry: FinanceEntry) {
    setEditEntry(entry);
    setForm({
      type:         entry.type,
      date:         entry.date?.slice(0, 10) || '',
      description:  entry.description,
      amount:       String(entry.amount),
      received_from: entry.received_from || '',
      paid_to:      entry.paid_to    || '',
      category:     entry.category   || '',
      payment_mode: entry.payment_mode || '',
      reference:    entry.reference  || '',
      notes:        entry.notes      || '',
      project_id:   entry.project_id || '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.date || !form.description || !form.amount) {
      toast.error('Date, description and amount are required');
      return;
    }
    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    setSaving(true);
    try {
      const url    = editEntry ? `/api/finance/${editEntry.id}` : '/api/finance';
      const method = editEntry ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type: tab, amount: Number(form.amount), project_id: form.project_id || null }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed'); return; }
      toast.success(editEntry ? 'Entry updated' : 'Entry added');
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/finance/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); load(); }
    else toast.error('Failed to delete');
    setDeleteId(null);
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(filtered.map(e => ({
      Date:        formatDate(e.date),
      Description: e.description,
      Amount:      e.amount,
      Project:     e.project?.project_name || '',
      ...(tab === 'earning'
        ? { 'Received From': e.received_from, Reference: e.reference }
        : { 'Paid To': e.paid_to, Category: e.category }),
      'Payment Mode': e.payment_mode,
      Notes: e.notes,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === 'earning' ? 'Earnings' : 'Expenses');
    XLSX.writeFile(wb, `nsc-hr-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Excel exported');
  }

  if (!user) return null;

  const isEarning = tab === 'earning';

  return (
    <>
      <AdminTopbar title="Finance" user={user} />
      <div className="page-content">

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
              Total {isEarning ? 'Earnings' : 'Expenses'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: isEarning ? '#16A34A' : '#DC2626' }}>
              {formatCurrency(totalAmount)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{filtered.length} entries</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder={`Search ${isEarning ? 'earnings' : 'expenses'}...`}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: 160 }}
          />
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={projectFilter}
            onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Projects</option>
            <option value="__none__">General (No Project)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
          <input type="date" className="form-input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 148 }} title="From date" />
          <input type="date" className="form-input" value={to}   onChange={e => setTo(e.target.value)}   style={{ width: 148 }} title="To date" />
          {(from || to || projectFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); setProjectFilter(''); }}>Clear</Button>
          )}
          <Button variant="ghost" size="sm" onClick={exportExcel}>Export Excel</Button>
          <Button variant="primary" size="sm" onClick={openAdd}>+ Add {isEarning ? 'Earning' : 'Expense'}</Button>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t as 'earning' | 'expense'); setPage(1); setSearch(''); }} />

        <Card>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
          ) : paged.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{isEarning ? '💰' : '💸'}</div>
              <div>No {isEarning ? 'earnings' : 'expenses'} found</div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Project</th>
                      <th>{isEarning ? 'Received From' : 'Paid To'}</th>
                      {!isEarning && <th>Category</th>}
                      <th>Payment Mode</th>
                      {isEarning && <th>Reference</th>}
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(e => (
                      <tr key={e.id}>
                        <td className="muted">{formatDate(e.date)}</td>
                        <td style={{ fontWeight: 600 }}>{e.description}</td>
                        <td>
                          {e.project ? (
                            <Badge status="primary">{e.project.project_name}</Badge>
                          ) : (
                            <span className="muted">General</span>
                          )}
                        </td>
                        <td className="muted">{isEarning ? (e.received_from || '—') : (e.paid_to || '—')}</td>
                        {!isEarning && <td>{e.category ? <Badge status="primary">{e.category}</Badge> : <span className="muted">—</span>}</td>}
                        <td className="muted" style={{ textTransform: 'capitalize' }}>{e.payment_mode?.replace('_', ' ') || '—'}</td>
                        {isEarning && <td className="muted" style={{ fontFamily: 'monospace' }}>{e.reference || '—'}</td>}
                        <td>
                          <strong style={{ color: isEarning ? '#16A34A' : '#DC2626', fontSize: 15 }}>
                            {isEarning ? '+' : '-'}{formatCurrency(Number(e.amount))}
                          </strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button variant="outline" size="xs" onClick={() => openEdit(e)}>Edit</Button>
                            <Button variant="danger" size="xs" onClick={() => setDeleteId(e.id)}>Del</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface)' }}>
                      <td colSpan={isEarning ? 6 : 6} style={{ fontWeight: 700, padding: '10px 16px', color: 'var(--text-2)' }}>
                        Total ({filtered.length} records)
                      </td>
                      <td style={{ fontWeight: 800, fontSize: 16, padding: '10px 16px', color: isEarning ? '#16A34A' : '#DC2626' }}>
                        {isEarning ? '+' : '-'}{formatCurrency(totalAmount)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mobile-cards">
                {paged.map(e => (
                  <div key={e.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{e.description}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{formatDate(e.date)}</div>
                        {e.project && <div style={{ marginTop: 4 }}><Badge status="primary">{e.project.project_name}</Badge></div>}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: isEarning ? '#16A34A' : '#DC2626' }}>
                        {isEarning ? '+' : '-'}{formatCurrency(Number(e.amount))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 13, marginBottom: 10 }}>
                      <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>{isEarning ? 'RECEIVED FROM' : 'PAID TO'}</span>{(isEarning ? e.received_from : e.paid_to) || '—'}</div>
                      {!isEarning && <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>CATEGORY</span>{e.category || '—'}</div>}
                      <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>PAYMENT MODE</span><span style={{ textTransform: 'capitalize' }}>{e.payment_mode?.replace('_', ' ') || '—'}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="outline" size="xs" onClick={() => openEdit(e)}>Edit</Button>
                      <Button variant="danger" size="xs" onClick={() => setDeleteId(e.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} label="entries" />
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editEntry ? `Edit ${isEarning ? 'Earning' : 'Expense'}` : `Add ${isEarning ? 'Earning' : 'Expense'}`}
        maxWidth={540}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editEntry ? 'Update' : 'Add Entry'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Amount (SAR) *</label>
              <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="form-label">Description *</label>
            <input className="form-input" placeholder={isEarning ? 'e.g. Project payment from client' : 'e.g. Office rent for April'} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Project (optional) */}
          <div>
            <label className="form-label">
              Project <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional — leave blank for general entry)</span>
            </label>
            <select className="form-select" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
              <option value="">General (No Project)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}{p.client_name ? ` (${p.client_name})` : ''}</option>)}
            </select>
          </div>

          {isEarning ? (
            <>
              <div>
                <label className="form-label">Received From</label>
                <input className="form-input" placeholder="Client / company name" value={form.received_from} onChange={e => setForm(f => ({ ...f, received_from: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                    <option value="">Select...</option>
                    {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Reference</label>
                  <input className="form-input" placeholder="Invoice / ref no." value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Paid To</label>
                  <input className="form-input" placeholder="Vendor / person name" value={form.paid_to} onChange={e => setForm(f => ({ ...f, paid_to: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select category...</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Payment Mode</label>
                <select className="form-select" value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                  <option value="">Select...</option>
                  {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." style={{ resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Entry"
        maxWidth={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-2)' }}>Are you sure you want to delete this entry? This cannot be undone.</p>
      </Modal>
    </>
  );
}
