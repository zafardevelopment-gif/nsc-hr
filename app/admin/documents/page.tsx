'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { useUser } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { EmployeeDocument, Employee } from '@/types';
import toast from 'react-hot-toast';

const DOC_TYPES = [
  { value: 'iqama', label: 'Iqama' },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'work_permit', label: 'Work Permit' },
  { value: 'visa', label: 'Visa' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'expired',  label: 'Expired' },
  { key: 'expiring', label: 'Expiring Soon' },
  { key: 'active',   label: 'Active' },
];
const PAGE_SIZE = 15;

function docStatusColor(status: string) {
  if (status === 'expired')  return { bg: '#FEF2F2', color: '#DC2626', label: 'Expired' };
  if (status === 'expiring') return { bg: '#FFF7ED', color: '#C2410C', label: 'Expiring' };
  return { bg: '#F0FDF4', color: '#16A34A', label: 'Active' };
}

function daysUntilExpiry(expiryDate: string | undefined) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000);
}

const EMPTY_FORM = {
  employee_id: '', document_type: 'iqama', number: '',
  issue_date: '', expiry_date: '', notes: '',
};

export default function AdminDocumentsPage() {
  const { user } = useUser();
  const [tab, setTab] = useState('all');
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<EmployeeDocument | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab !== 'all' ? `&status=${tab}` : '';
      const [docsRes, empRes] = await Promise.all([
        fetch(`/api/documents?limit=500${statusParam}`),
        fetch('/api/employees?limit=500'),
      ]);
      const [docsJson, empJson] = await Promise.all([docsRes.json(), empRes.json()]);
      setDocs(docsJson.data || []);
      setEmployees(empJson.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filtered = docs.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    const emp = d.employee as Employee | undefined;
    return (
      (emp?.full_name || '').toLowerCase().includes(q) ||
      (emp?.employee_code || '').toLowerCase().includes(q) ||
      d.number.toLowerCase().includes(q) ||
      d.document_type.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openAdd() {
    setEditDoc(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(doc: EmployeeDocument) {
    setEditDoc(doc);
    setForm({
      employee_id: doc.employee_id,
      document_type: doc.document_type,
      number: doc.number,
      issue_date: doc.issue_date?.slice(0, 10) || '',
      expiry_date: doc.expiry_date?.slice(0, 10) || '',
      notes: doc.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.employee_id || !form.document_type || !form.number) {
      toast.error('Employee, type and number are required');
      return;
    }
    setSaving(true);
    try {
      const url = editDoc ? `/api/documents/${editDoc.id}` : '/api/documents';
      const method = editDoc ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed'); return; }
      toast.success(editDoc ? 'Document updated' : 'Document added');
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); load(); }
    else toast.error('Failed to delete');
    setDeleteId(null);
  }

  // Summary counts
  const expiredCount  = docs.filter(d => d.status === 'expired').length;
  const expiringCount = docs.filter(d => d.status === 'expiring').length;
  const activeCount   = docs.filter(d => d.status === 'active').length;

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="ID Documents" user={user} />
      <div className="page-content">

        {/* Summary cards */}
        <div className="stat-grid">
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚨</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#DC2626' }}>{expiredCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Expired</div>
            </div>
          </div>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚠️</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#C2410C' }}>{expiringCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Expiring (30d)</div>
            </div>
          </div>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✅</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A' }}>{activeCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Active</div>
            </div>
          </div>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#EEF3FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📄</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{docs.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Total Documents</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="Search by name, code, document number..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Button variant="primary" size="sm" onClick={openAdd}>+ Add Document</Button>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setPage(1); setSearch(''); }} />

        <Card>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
          ) : paged.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📄</div><div>No documents found</div></div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Document Type</th>
                      <th>Number</th>
                      <th>Issue Date</th>
                      <th>Expiry Date</th>
                      <th>Days Left</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(doc => {
                      const emp = doc.employee as Employee | undefined;
                      const sc = docStatusColor(doc.status);
                      const days = daysUntilExpiry(doc.expiry_date);
                      const docLabel = DOC_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type;
                      return (
                        <tr key={doc.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar name={emp?.full_name || ''} size="sm" />
                              <div>
                                <div style={{ fontWeight: 600 }}>{emp?.full_name || '—'}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{emp?.employee_code}</div>
                              </div>
                            </div>
                          </td>
                          <td><Badge status="primary">{docLabel}</Badge></td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{doc.number}</td>
                          <td className="muted">{doc.issue_date ? formatDate(doc.issue_date) : '—'}</td>
                          <td className="muted">{doc.expiry_date ? formatDate(doc.expiry_date) : '—'}</td>
                          <td>
                            {days === null ? <span className="muted">—</span> : (
                              <span style={{ fontWeight: 700, color: days < 0 ? '#DC2626' : days <= 30 ? '#C2410C' : '#16A34A' }}>
                                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                              {sc.label}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {doc.file_url && (
                                <Button variant="ghost" size="xs" onClick={() => window.open(doc.file_url, '_blank')}>View</Button>
                              )}
                              <Button variant="outline" size="xs" onClick={() => openEdit(doc)}>Edit</Button>
                              <Button variant="danger" size="xs" onClick={() => setDeleteId(doc.id)}>Del</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mobile-cards">
                {paged.map(doc => {
                  const emp = doc.employee as Employee | undefined;
                  const sc = docStatusColor(doc.status);
                  const days = daysUntilExpiry(doc.expiry_date);
                  const docLabel = DOC_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type;
                  return (
                    <div key={doc.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={emp?.full_name || ''} size="sm" />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{emp?.full_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{emp?.employee_code}</div>
                          </div>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                          {sc.label}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
                        <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>TYPE</span>{docLabel}</div>
                        <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>NUMBER</span><span style={{ fontFamily: 'monospace' }}>{doc.number}</span></div>
                        <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>EXPIRY</span>{doc.expiry_date ? formatDate(doc.expiry_date) : '—'}</div>
                        <div><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>DAYS LEFT</span>
                          {days === null ? '—' : <span style={{ fontWeight: 700, color: days < 0 ? '#DC2626' : days <= 30 ? '#C2410C' : '#16A34A' }}>{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        {doc.file_url && <Button variant="ghost" size="xs" onClick={() => window.open(doc.file_url, '_blank')}>View File</Button>}
                        <Button variant="outline" size="xs" onClick={() => openEdit(doc)}>Edit</Button>
                        <Button variant="danger" size="xs" onClick={() => setDeleteId(doc.id)}>Delete</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} label="documents" />
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editDoc ? 'Edit Document' : 'Add Document'}
        maxWidth={540}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editDoc ? 'Update' : 'Add Document'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!editDoc && (
            <div>
              <label className="form-label">Employee *</label>
              <select className="form-select" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
                <option value="">Select employee...</option>
                {employees.filter(e => e.active).map(e => (
                  <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Document Type *</label>
              <select className="form-select" value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Document Number *</label>
              <input className="form-input" placeholder="e.g. 2345678901" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Issue Date</label>
              <input type="date" className="form-input" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Expiry Date</label>
              <input type="date" className="form-input" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." style={{ resize: 'vertical' }} />
          </div>
          {form.expiry_date && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: docStatusColor(
              (() => {
                const days = daysUntilExpiry(form.expiry_date);
                if (days === null) return 'active';
                if (days < 0) return 'expired';
                if (days <= 30) return 'expiring';
                return 'active';
              })()
            ).bg, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              {(() => {
                const days = daysUntilExpiry(form.expiry_date);
                const sc = docStatusColor(days === null ? 'active' : days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'active');
                return <span style={{ color: sc.color, fontWeight: 600 }}>{days === null ? '' : days < 0 ? `⚠️ Expired ${Math.abs(days)} days ago` : days === 0 ? '⚠️ Expires today' : days <= 30 ? `⚠️ Expires in ${days} days` : `✅ Active — ${days} days remaining`}</span>;
              })()}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Document"
        maxWidth={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-2)' }}>Are you sure you want to delete this document? This cannot be undone.</p>
      </Modal>
    </>
  );
}
