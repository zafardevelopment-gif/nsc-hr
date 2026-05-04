'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Pagination } from '@/components/ui/Pagination';
import { useUser } from '@/lib/hooks';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProjectWorkLog, Project, Employee, ProjectAssignment } from '@/types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 20;

const RATE_TYPE_LABEL: Record<string, string> = {
  per_hour: 'Per Hour',
  per_day:  'Per Day',
  fixed:    'Fixed',
};

const EMPTY_FORM = {
  employee_id: '',
  project_id:  '',
  quantity:    '',
  date:        new Date().toISOString().slice(0, 10),
  notes:       '',
};

export default function ProjectWorkLogsPage() {
  const { user } = useUser();

  const [logs, setLogs]             = useState<ProjectWorkLog[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [filterProject, setFP]      = useState('');
  const [filterEmployee, setFE]     = useState('');
  const [filterFrom, setFrom]       = useState('');
  const [filterTo, setTo]           = useState('');

  // modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [editLog, setEditLog]       = useState<ProjectWorkLog | null>(null);
  const [form, setForm]             = useState<Record<string, string>>({ ...EMPTY_FORM });
  const [saving, setSaving]         = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);

  // live assignment lookup
  const [assignment, setAssignment]           = useState<ProjectAssignment | null>(null);
  const [assignmentLoading, setAssLoading]    = useState(false);
  const [assignmentError, setAssignmentError] = useState('');

  // ── loaders ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/project-work-logs?limit=1000';
      if (filterProject)  url += `&project_id=${filterProject}`;
      if (filterEmployee) url += `&employee_id=${filterEmployee}`;
      if (filterFrom)     url += `&from=${filterFrom}`;
      if (filterTo)       url += `&to=${filterTo}`;
      const res = await fetch(url);
      const json = await res.json();
      setLogs(json.data || []);
    } catch { toast.error('Failed to load work logs'); }
    finally { setLoading(false); }
  }, [filterProject, filterEmployee, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/projects?status=active').then(r => r.json()).then(j => setProjects(j.data || [])).catch(() => {});
    fetch('/api/employees?emp_type=part-time&limit=500').then(r => r.json()).then(j => setEmployees(j.data || [])).catch(() => {});
  }, []);

  // ── fetch assignment rate when employee + project both selected ──
  useEffect(() => {
    if (!form.employee_id || !form.project_id || editLog) {
      setAssignment(null);
      setAssignmentError('');
      return;
    }
    setAssLoading(true);
    setAssignmentError('');
    fetch(`/api/project-assignments?project_id=${form.project_id}&employee_id=${form.employee_id}`)
      .then(r => r.json())
      .then(j => {
        const found = (j.data || []).find((a: ProjectAssignment) => a.active);
        if (found) {
          setAssignment(found);
          setAssignmentError('');
        } else {
          setAssignment(null);
          setAssignmentError('This employee is not assigned to this project. Go to Projects → Assign Employee first.');
        }
      })
      .catch(() => setAssignmentError('Failed to check assignment'))
      .finally(() => setAssLoading(false));
  }, [form.employee_id, form.project_id, editLog]);

  // ── modal helpers ─────────────────────────────────────────
  function openAdd() {
    setEditLog(null);
    setForm({ ...EMPTY_FORM });
    setAssignment(null);
    setAssignmentError('');
    setModalOpen(true);
  }

  function openEdit(log: ProjectWorkLog) {
    setEditLog(log);
    setAssignment(null);
    setForm({
      employee_id: log.employee_id,
      project_id:  log.project_id,
      quantity:    String(log.quantity),
      date:        log.date.slice(0, 10),
      notes:       log.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.employee_id) { toast.error('Select an employee'); return; }
    if (!form.project_id)  { toast.error('Select a project'); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { toast.error('Quantity must be > 0'); return; }
    if (!form.date)        { toast.error('Date is required'); return; }
    if (!editLog && !assignment) { toast.error(assignmentError || 'No assignment found'); return; }

    setSaving(true);
    try {
      const url    = editLog ? `/api/project-work-logs/${editLog.id}` : '/api/project-work-logs';
      const method = editLog ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed'); return; }
      toast.success(editLog ? 'Log updated' : 'Work log saved');
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/project-work-logs/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); load(); }
    else toast.error('Failed to delete');
    setDeleteId(null);
  }

  // ── filter & paginate ─────────────────────────────────────
  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.employee?.full_name || '').toLowerCase().includes(q) ||
      (l.project?.project_name || '').toLowerCase().includes(q) ||
      (l.notes || '').toLowerCase().includes(q)
    );
  });
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paged       = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalAmount = filtered.reduce((s, l) => s + Number(l.total_amount || 0), 0);

  // ── Excel export ──────────────────────────────────────────
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(filtered.map(l => ({
      Date:          formatDate(l.date),
      Employee:      l.employee?.full_name || l.employee_id,
      'Emp Code':    l.employee?.employee_code || '',
      Project:       l.project?.project_name || l.project_id,
      'Rate Type':   RATE_TYPE_LABEL[l.assignment?.rate_type || ''] || '',
      Quantity:      l.quantity,
      'Rate (SAR)':  l.rate,
      'Total (SAR)': l.total_amount,
      Notes:         l.notes || '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Work Logs');
    XLSX.writeFile(wb, `nsc-project-work-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported');
  }

  // Live preview for add modal
  const previewTotal = assignment && form.quantity && Number(form.quantity) > 0
    ? Number(form.quantity) * assignment.rate
    : null;

  // For edit modal, compute from stored rate
  const editPreviewTotal = editLog && form.quantity && Number(form.quantity) > 0
    ? Number(form.quantity) * editLog.rate
    : null;

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Project Work Logs" user={user} />
      <div className="page-content">

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Total Logs</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{filtered.length}</div>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Total Payable</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(totalAmount)}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="Search employee or project..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: 160 }}
          />
          <select className="form-select" style={{ width: 'auto' }} value={filterProject} onChange={e => { setFP(e.target.value); setPage(1); }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={filterEmployee} onChange={e => { setFE(e.target.value); setPage(1); }}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
          </select>
          <input type="date" className="form-input" value={filterFrom} onChange={e => setFrom(e.target.value)} style={{ width: 148 }} title="From date" />
          <input type="date" className="form-input" value={filterTo}   onChange={e => setTo(e.target.value)}   style={{ width: 148 }} title="To date" />
          {(filterFrom || filterTo) && <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</Button>}
          <Button variant="ghost"   size="sm" onClick={exportExcel}>Export Excel</Button>
          <Button variant="primary" size="sm" onClick={openAdd}>+ Add Log</Button>
        </div>

        <Card>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
          ) : paged.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div>No work logs found</div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Project</th>
                      <th>Rate Type</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Total</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(l => (
                      <tr key={l.id}>
                        <td className="muted">{formatDate(l.date)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={l.employee?.full_name || ''} size="sm" />
                            <div>
                              <div style={{ fontWeight: 600 }}>{l.employee?.full_name || l.employee_id}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l.employee?.employee_code}</div>
                            </div>
                          </div>
                        </td>
                        <td><Badge status="primary">{l.project?.project_name || l.project_id}</Badge></td>
                        <td className="muted" style={{ fontSize: 12 }}>
                          {RATE_TYPE_LABEL[l.assignment?.rate_type || ''] || '—'}
                        </td>
                        <td><strong>{l.quantity}</strong></td>
                        <td className="muted">{formatCurrency(l.rate)}</td>
                        <td>
                          <strong style={{ color: 'var(--primary)', fontSize: 15 }}>
                            {formatCurrency(Number(l.total_amount))}
                          </strong>
                        </td>
                        <td className="muted" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.notes || '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button variant="outline" size="xs" onClick={() => openEdit(l)}>Edit</Button>
                            <Button variant="danger"  size="xs" onClick={() => setDeleteId(l.id)}>Del</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface)' }}>
                      <td colSpan={6} style={{ fontWeight: 700, padding: '10px 16px', color: 'var(--text-2)' }}>
                        Total ({filtered.length} records)
                      </td>
                      <td style={{ fontWeight: 800, fontSize: 16, padding: '10px 16px', color: 'var(--primary)' }}>
                        {formatCurrency(totalAmount)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mobile-cards">
                {paged.map(l => (
                  <div key={l.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={l.employee?.full_name || ''} size="sm" />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{l.employee?.full_name || l.employee_id}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l.employee?.employee_code}</div>
                        </div>
                      </div>
                      <strong style={{ color: 'var(--primary)', fontSize: 16 }}>{formatCurrency(Number(l.total_amount))}</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 13, marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>PROJECT</span>
                        <Badge status="primary">{l.project?.project_name || '—'}</Badge>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>DATE</span>
                        {formatDate(l.date)}
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block' }}>QTY × RATE</span>
                        {l.quantity} × {formatCurrency(l.rate)}
                        {l.assignment?.rate_type && (
                          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>
                            ({RATE_TYPE_LABEL[l.assignment.rate_type]})
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="outline" size="xs" onClick={() => openEdit(l)}>Edit</Button>
                      <Button variant="danger"  size="xs" onClick={() => setDeleteId(l.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} label="logs" />
        </Card>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editLog ? 'Edit Work Log' : 'Add Work Log'}
        maxWidth={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={handleSave}
              disabled={!editLog && !!assignmentError}
            >
              {editLog ? 'Update' : 'Save Log'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Employee selector */}
          <div>
            <label className="form-label">Temporary Employee *</label>
            <select
              className="form-select"
              value={form.employee_id}
              onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              disabled={!!editLog}
            >
              <option value="">Select employee...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name} — {e.employee_code}</option>
              ))}
            </select>
          </div>

          {/* Project selector */}
          <div>
            <label className="form-label">Project *</label>
            <select
              className="form-select"
              value={form.project_id}
              onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              disabled={!!editLog}
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_name}</option>
              ))}
            </select>
          </div>

          {/* Assignment rate info box */}
          {!editLog && form.employee_id && form.project_id && (
            assignmentLoading ? (
              <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-3)' }}>
                Checking assignment...
              </div>
            ) : assignment ? (
              <div style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
                  Employee Rate for this Project
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>
                  {formatCurrency(assignment.rate)}
                  <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 6 }}>
                    / {RATE_TYPE_LABEL[assignment.rate_type] || assignment.rate_type}
                  </span>
                </div>
              </div>
            ) : assignmentError ? (
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#DC2626' }}>
                ⚠ {assignmentError}
              </div>
            ) : null
          )}

          {/* For edit: show stored rate */}
          {editLog && (
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Stored Rate</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                {formatCurrency(editLog.rate)}
                {editLog.assignment?.rate_type && (
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>
                    / {RATE_TYPE_LABEL[editLog.assignment.rate_type]}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Rate is locked at the time of logging</div>
            </div>
          )}

          {/* Quantity + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Quantity *</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 5"
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input
                type="date"
                className="form-input"
                value={form.date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          {/* Live total preview */}
          {(previewTotal !== null || editPreviewTotal !== null) && (
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Total Amount</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
                {formatCurrency(previewTotal ?? editPreviewTotal ?? 0)}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Optional notes..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Work Log"
        maxWidth={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-2)' }}>Are you sure you want to delete this work log? This cannot be undone.</p>
      </Modal>
    </>
  );
}
