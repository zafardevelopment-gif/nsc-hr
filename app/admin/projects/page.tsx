'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { useUser } from '@/lib/hooks';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Project, ProjectAssignment, Employee } from '@/types';
import toast from 'react-hot-toast';

const RATE_TYPES = [
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'per_day',  label: 'Per Day' },
  { value: 'fixed',    label: 'Fixed' },
];

const EMPTY_FORM = {
  project_name: '', project_cost: '', client_name: '',
  start_date: '', end_date: '', description: '', status: 'active',
};

export default function ProjectsPage() {
  const { user } = useUser();

  // --- projects list ---
  const [projects, setProjects]       = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('');

  // --- project modal ---
  const [modalOpen, setModalOpen]     = useState(false);
  const [editProject, setEdit]        = useState<Project | null>(null);
  const [form, setForm]               = useState<Record<string, string>>({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [deleteId, setDeleteId]       = useState<string | null>(null);

  // --- assignments panel ---
  const [selectedProject, setSelected] = useState<Project | null>(null);
  const [assignments, setAssignments]  = useState<ProjectAssignment[]>([]);
  const [employees, setEmployees]      = useState<Employee[]>([]);
  const [assLoading, setAssLoading]    = useState(false);
  const [assModalOpen, setAssModal]    = useState(false);
  const [editAss, setEditAss]          = useState<ProjectAssignment | null>(null);
  const [assForm, setAssForm]          = useState({ employee_id: '', rate: '', rate_type: 'per_unit' });
  const [assSaving, setAssSaving]      = useState(false);
  const [deleteAssId, setDeleteAssId]  = useState<string | null>(null);

  // ── load projects ──────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/projects?status=${statusFilter}` : '/api/projects';
      const res = await fetch(url);
      const json = await res.json();
      setProjects(json.data || []);
    } catch { toast.error('Failed to load projects'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // ── load part-time employees (for assignment modal) ────────
  useEffect(() => {
    fetch('/api/employees?emp_type=part-time&limit=500')
      .then(r => r.json()).then(j => setEmployees(j.data || [])).catch(() => {});
  }, []);

  // ── load assignments for selected project ─────────────────
  const loadAssignments = useCallback(async (projectId: string) => {
    setAssLoading(true);
    try {
      const res = await fetch(`/api/project-assignments?project_id=${projectId}&active=false`);
      const json = await res.json();
      setAssignments(json.data || []);
    } catch { toast.error('Failed to load assignments'); }
    finally { setAssLoading(false); }
  }, []);

  function selectProject(p: Project) {
    setSelected(p);
    loadAssignments(p.id);
  }

  // ── project CRUD ───────────────────────────────────────────
  function openAdd() {
    setEdit(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }
  function openEdit(p: Project) {
    setEdit(p);
    setForm({
      project_name: p.project_name,
      project_cost: p.project_cost ? String(p.project_cost) : '',
      client_name:  p.client_name  || '',
      start_date:   p.start_date   || '',
      end_date:     p.end_date     || '',
      description:  p.description  || '',
      status:       p.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.project_name.trim()) { toast.error('Project name is required'); return; }
    setSaving(true);
    try {
      const url    = editProject ? `/api/projects/${editProject.id}` : '/api/projects';
      const method = editProject ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          project_cost: form.project_cost ? Number(form.project_cost) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed'); return; }
      toast.success(editProject ? 'Project updated' : 'Project created');
      setModalOpen(false);
      loadProjects();
      if (selectedProject?.id === editProject?.id) setSelected(json.data);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (res.ok) {
      toast.success('Project deleted');
      if (selectedProject?.id === id) setSelected(null);
      loadProjects();
    } else toast.error(json.error || 'Failed to delete');
    setDeleteId(null);
  }

  async function toggleStatus(p: Project) {
    const next = p.status === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/projects/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast.success(`Project ${next === 'active' ? 'activated' : 'deactivated'}`);
      loadProjects();
      if (selectedProject?.id === p.id) setSelected({ ...p, status: next });
    } else toast.error('Failed to update status');
  }

  // ── assignment CRUD ────────────────────────────────────────
  function openAssignAdd() {
    setEditAss(null);
    setAssForm({ employee_id: '', rate: '', rate_type: 'per_unit' });
    setAssModal(true);
  }
  function openAssignEdit(a: ProjectAssignment) {
    setEditAss(a);
    setAssForm({ employee_id: a.employee_id, rate: String(a.rate), rate_type: a.rate_type });
    setAssModal(true);
  }

  async function handleAssSave() {
    if (!assForm.employee_id) { toast.error('Select an employee'); return; }
    if (assForm.rate === '' || Number(assForm.rate) < 0) { toast.error('Enter a valid rate (0 or more)'); return; }
    if (!selectedProject) return;
    setAssSaving(true);
    try {
      if (editAss) {
        const res = await fetch(`/api/project-assignments/${editAss.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rate: Number(assForm.rate), rate_type: assForm.rate_type }),
        });
        const json = await res.json();
        if (!res.ok) { toast.error(json.error || 'Failed'); return; }
        toast.success('Rate updated');
      } else {
        const res = await fetch('/api/project-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id:  selectedProject.id,
            employee_id: assForm.employee_id,
            rate:        Number(assForm.rate),
            rate_type:   assForm.rate_type,
          }),
        });
        const json = await res.json();
        if (!res.ok) { toast.error(json.error || 'Failed'); return; }
        toast.success('Employee assigned');
      }
      setAssModal(false);
      loadAssignments(selectedProject.id);
    } finally { setAssSaving(false); }
  }

  async function handleAssDelete(id: string) {
    const res = await fetch(`/api/project-assignments/${id}`, { method: 'DELETE' });
    const json = await res.json();
    toast.success(json.message || 'Removed');
    if (selectedProject) loadAssignments(selectedProject.id);
    setDeleteAssId(null);
  }

  async function toggleAssActive(a: ProjectAssignment) {
    const res = await fetch(`/api/project-assignments/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !a.active }),
    });
    if (res.ok) {
      toast.success(a.active ? 'Deactivated' : 'Re-activated');
      if (selectedProject) loadAssignments(selectedProject.id);
    }
  }

  const filtered = projects.filter(p =>
    !search ||
    p.project_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name  || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.description  || '').toLowerCase().includes(search.toLowerCase())
  );

  // Employees not yet assigned (active assignments)
  const assignedEmpIds = new Set(assignments.filter(a => a.active).map(a => a.employee_id));
  const unassignedEmployees = employees.filter(e => !assignedEmpIds.has(e.id));

  if (!user) return null;

  const activeCount   = projects.filter(p => p.status === 'active').length;
  const inactiveCount = projects.filter(p => p.status === 'inactive').length;

  return (
    <>
      <AdminTopbar title="Projects" user={user} />
      <div className="page-content">

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 }}>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{projects.length}</div>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Active</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#16A34A' }}>{activeCount}</div>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Inactive</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-3)' }}>{inactiveCount}</div>
          </div>
        </div>

        {/* Two-column layout: Projects list | Assignment panel */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedProject ? '1fr 1fr' : '1fr', gap: 20 }}>

          {/* ── LEFT: Projects list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-input"
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 140 }}
              />
              <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button variant="primary" size="sm" onClick={openAdd}>+ New</Button>
            </div>

            <Card>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📁</div><div>No projects found</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filtered.map(p => {
                    const isSelected = selectedProject?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => selectProject(p)}
                        style={{
                          padding: '14px 18px',
                          borderBottom: '1px solid var(--border-2)',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--primary-light)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: isSelected ? 'var(--primary)' : 'var(--text)' }}>
                            {p.project_name}
                          </div>
                          <Badge status={p.status === 'active' ? 'active' : 'inactive'} dot>
                            {p.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        {p.client_name && (
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                            Client: <strong style={{ color: 'var(--text-2)' }}>{p.client_name}</strong>
                          </div>
                        )}
                        {p.project_cost && (
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                            Budget: <strong style={{ color: 'var(--primary)' }}>{formatCurrency(p.project_cost)}</strong>
                          </div>
                        )}
                        {(p.start_date || p.end_date) && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {p.start_date ? formatDate(p.start_date) : '—'} → {p.end_date ? formatDate(p.end_date) : 'Ongoing'}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                          <Button variant="outline" size="xs" onClick={() => openEdit(p)}>Edit</Button>
                          <Button variant="ghost"   size="xs" onClick={() => toggleStatus(p)}>
                            {p.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button variant="danger"  size="xs" onClick={() => setDeleteId(p.id)}>Del</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── RIGHT: Employee Assignments panel ── */}
          {selectedProject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedProject.project_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Assigned Employees & Rates</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>✕ Close</Button>
                  <Button variant="primary" size="sm" onClick={openAssignAdd}>+ Assign Employee</Button>
                </div>
              </div>

              <Card>
                {assLoading ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
                ) : assignments.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <div className="empty-icon">👤</div>
                    <div>No employees assigned yet</div>
                    <Button variant="primary" size="sm" style={{ marginTop: 12 }} onClick={openAssignAdd}>
                      Assign First Employee
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {assignments.map(a => (
                      <div key={a.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-2)', opacity: a.active ? 1 : 0.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={a.employee?.full_name || ''} size="sm" />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{a.employee?.full_name || a.employee_id}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                {a.employee?.employee_code} · {a.employee?.department || 'No dept'}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>
                              {formatCurrency(a.rate)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {RATE_TYPES.find(r => r.value === a.rate_type)?.label || a.rate_type}
                            </div>
                          </div>
                        </div>
                        {!a.active && (
                          <Badge status="inactive" style={{ marginBottom: 8 }}>Deactivated</Badge>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="outline" size="xs" onClick={() => openAssignEdit(a)}>Edit Rate</Button>
                          <Button variant="ghost"   size="xs" onClick={() => toggleAssActive(a)}>
                            {a.active ? 'Remove' : 'Re-activate'}
                          </Button>
                          {!a.active && (
                            <Button variant="danger" size="xs" onClick={() => setDeleteAssId(a.id)}>Delete</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Quick salary summary for this project */}
              {assignments.filter(a => a.active).length > 0 && (
                <div className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>
                    ASSIGNED EMPLOYEES ({assignments.filter(a => a.active).length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {assignments.filter(a => a.active).map(a => (
                      <div key={a.id} style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{a.employee?.full_name?.split(' ')[0]}</span>
                        <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>@ {formatCurrency(a.rate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Project Add/Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editProject ? 'Edit Project' : 'New Project'}
        maxWidth={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editProject ? 'Update' : 'Create Project'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Project Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Riyadh Cleaning Contract"
              value={form.project_name}
              onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Client Name</label>
              <input
                className="form-input"
                placeholder="e.g. ARAMCO"
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Project Budget (SAR)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Total cost / budget"
                min="0"
                step="0.01"
                value={form.project_cost}
                onChange={e => setForm(f => ({ ...f, project_cost: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Optional project description..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ── Assign Employee Modal ── */}
      <Modal
        open={assModalOpen}
        onClose={() => setAssModal(false)}
        title={editAss ? 'Edit Employee Rate' : `Assign Employee — ${selectedProject?.project_name}`}
        maxWidth={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssModal(false)}>Cancel</Button>
            <Button variant="primary" loading={assSaving} onClick={handleAssSave}>
              {editAss ? 'Update Rate' : 'Assign'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!editAss && (
            <div>
              <label className="form-label">Temporary Employee *</label>
              <select
                className="form-select"
                value={assForm.employee_id}
                onChange={e => setAssForm(f => ({ ...f, employee_id: e.target.value }))}
              >
                <option value="">Select employee...</option>
                {(editAss ? employees : unassignedEmployees).map(e => (
                  <option key={e.id} value={e.id}>{e.full_name} — {e.employee_code}</option>
                ))}
              </select>
              {unassignedEmployees.length === 0 && !editAss && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  All temporary employees are already assigned to this project.
                </div>
              )}
            </div>
          )}

          {editAss && (
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={editAss.employee?.full_name || ''} size="sm" />
              <div>
                <div style={{ fontWeight: 700 }}>{editAss.employee?.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{editAss.employee?.employee_code}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Rate (SAR) *</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 150"
                min="0"
                step="0.01"
                value={assForm.rate}
                onChange={e => setAssForm(f => ({ ...f, rate: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Rate Type *</label>
              <select
                className="form-select"
                value={assForm.rate_type}
                onChange={e => setAssForm(f => ({ ...f, rate_type: e.target.value }))}
              >
                {RATE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {assForm.rate && Number(assForm.rate) > 0 && (
            <div style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 2 }}>
                This employee will earn:
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                {formatCurrency(Number(assForm.rate))} / {RATE_TYPES.find(r => r.value === assForm.rate_type)?.label || assForm.rate_type}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                Total salary = quantity logged × {formatCurrency(Number(assForm.rate))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete project confirm ── */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Project"
        maxWidth={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-2)' }}>Delete this project? This will fail if work logs exist — deactivate instead.</p>
      </Modal>

      {/* ── Delete assignment confirm ── */}
      <Modal
        open={!!deleteAssId}
        onClose={() => setDeleteAssId(null)}
        title="Remove Assignment"
        maxWidth={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteAssId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteAssId && handleAssDelete(deleteAssId)}>Remove</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-2)' }}>Permanently remove this employee from the project?</p>
      </Modal>
    </>
  );
}
