'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Progress } from '@/components/ui/Progress';
import { Pagination } from '@/components/ui/Pagination';
import { useUser } from '@/lib/hooks';
import { Employee, Project, ProjectAssignment } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const RATE_TYPE_LABEL: Record<string, string> = {
  per_unit: 'Per Unit', per_hour: 'Per Hour', per_day: 'Per Day', fixed: 'Fixed',
};

const empSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  mobile: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  department: z.string().min(1, 'Department required'),
  designation: z.string().optional(),
  joining_date: z.string().min(1, 'Joining date required'),
  emp_type: z.enum(['permanent', 'part-time']),
  salary_type: z.enum(['monthly', 'hourly', 'fixed']),
  monthly_salary: z.string().optional(),
  hourly_rate: z.string().optional(),
  id_type: z.enum(['iqama', 'passport', 'national_id']).optional(),
  id_number: z.string().optional(),
  id_expiry: z.string().optional(),
  notes: z.string().optional(),
  username: z.string().min(3, 'Username min 3 chars').optional().or(z.literal('')),
  password: z.string().min(6, 'Password min 6 chars').optional().or(z.literal('')),
});

type EmpForm = z.infer<typeof empSchema>;

export default function EmployeesPage() {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<EmpForm>({
    resolver: zodResolver(empSchema),
    defaultValues: { emp_type: 'permanent', salary_type: 'monthly' },
  });
  const empType   = watch('emp_type');
  const salaryType = watch('salary_type');

  // ── project assignments (part-time employees) ──────────────
  const [projects, setProjects]               = useState<Project[]>([]);
  const [empAssignments, setEmpAssignments]   = useState<ProjectAssignment[]>([]);  // assignments of the employee being viewed/edited
  const [assLoading, setAssLoading]           = useState(false);
  // inline assignment form inside add/edit modal
  const [assProjectId, setAssProjectId]       = useState('');
  const [assRate, setAssRate]                 = useState('');
  const [assRateType, setAssRateType]         = useState('per_unit');
  const [addingAss, setAddingAss]             = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search, page: String(page), limit: String(perPage),
        ...(typeFilter && { type: typeFilter }),
        ...(deptFilter && { dept: deptFilter }),
      });
      const res = await fetch(`/api/employees?${params}`);
      const json = await res.json();
      setEmployees(json.data || []);
      setTotal(json.count || 0);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  }, [search, typeFilter, deptFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.json())
      .then(j => setDepartments((j.data || []).map((d: { name: string }) => d.name)))
      .catch(() => {});
    fetch('/api/projects?status=active')
      .then(r => r.json())
      .then(j => setProjects(j.data || []))
      .catch(() => {});
  }, []);

  // Load assignments when editing a part-time employee
  async function loadEmpAssignments(empId: string) {
    setAssLoading(true);
    try {
      const res = await fetch(`/api/project-assignments?employee_id=${empId}`);
      const json = await res.json();
      setEmpAssignments(json.data || []);
    } catch { /* silent */ }
    finally { setAssLoading(false); }
  }

  function resetAssForm() {
    setAssProjectId(''); setAssRate(''); setAssRateType('per_unit');
  }

  async function handleAddAssignment(empId: string) {
    if (!assProjectId) { toast.error('Select a project'); return; }
    if (assRate === '' || Number(assRate) < 0) { toast.error('Enter a valid rate'); return; }
    setAddingAss(true);
    try {
      const res = await fetch('/api/project-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: assProjectId, employee_id: empId, rate: Number(assRate), rate_type: assRateType }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed'); return; }
      toast.success('Project assigned');
      resetAssForm();
      loadEmpAssignments(empId);
    } finally { setAddingAss(false); }
  }

  async function handleRemoveAssignment(assId: string, empId: string) {
    const res = await fetch(`/api/project-assignments/${assId}`, { method: 'DELETE' });
    const json = await res.json();
    toast.success(json.message || 'Removed');
    loadEmpAssignments(empId);
  }

  function closeModal() {
    setShowAdd(false);
    setEditEmp(null);
    setEmpAssignments([]);
    resetAssForm();
    reset();
  }

  async function onSubmit(data: EmpForm) {
    setSubmitting(true);
    const tid = toast.loading(editEmp ? 'Saving changes...' : 'Creating employee...');
    try {
      const payload = {
        ...data,
        monthly_salary: data.monthly_salary ? parseFloat(data.monthly_salary) : null,
        hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : null,
        active: true,
      };

      const url = editEmp ? `/api/employees/${editEmp.id}` : '/api/employees';
      const method = editEmp ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success(editEmp ? 'Employee updated' : 'Employee created', { id: tid });
      setShowAdd(false);
      setEditEmp(null);
      reset();
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed', { id: tid });
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(emp: Employee) {
    setEditEmp(emp);
    setEmpAssignments([]);
    resetAssForm();
    reset({
      full_name: emp.full_name,
      email: emp.email || '',
      mobile: emp.mobile || '',
      whatsapp: emp.whatsapp || '',
      address: emp.address || '',
      department: emp.department || '',
      designation: emp.designation || '',
      joining_date: emp.joining_date,
      emp_type: emp.emp_type,
      salary_type: emp.salary_type || 'monthly',
      monthly_salary: emp.monthly_salary ? String(emp.monthly_salary) : '',
      hourly_rate: emp.hourly_rate ? String(emp.hourly_rate) : '',
      id_type: emp.id_type || undefined,
      id_number: emp.id_number || '',
      id_expiry: emp.id_expiry || '',
      notes: emp.notes || '',
    });
    if (emp.emp_type === 'part-time') loadEmpAssignments(emp.id);
    setShowAdd(true);
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      await fetch(`/api/employees/${deleteConfirm.id}`, { method: 'DELETE' });
      toast.success('Employee deactivated');
      setDeleteConfirm(null);
      load();
    } catch { toast.error('Failed to delete'); }
  }

  const totalPages = Math.ceil(total / perPage);

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Employees" user={user}
        actions={<Button onClick={() => { setEditEmp(null); setEmpAssignments([]); resetAssForm(); reset({ emp_type: 'permanent', salary_type: 'monthly' }); setShowAdd(true); }} icon="＋">Add Employee</Button>}
      />
      <div className="page-content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput placeholder="Search by name, email, department..." value={search} onChange={v => { setSearch(v); setPage(1); }} />
          {['', 'permanent', 'part-time'].map(t => (
            <button key={t} className={`chip ${typeFilter === t ? 'active' : ''}`} onClick={() => { setTypeFilter(t); setPage(1); }}>
              {t === '' ? 'All' : t === 'permanent' ? 'Permanent' : 'Part-Time'}
            </button>
          ))}
          <select className="form-select" style={{ width: 'auto' }} value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Employee</th><th>Type</th><th>Salary</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">👥</div><div>No employees found</div></div></td></tr>
                ) : employees.map(e => (
                  <tr key={e.id}>
                    <td className="muted" style={{ fontWeight: 600, fontFamily: 'monospace' }}>{e.employee_code}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={e.full_name} size="sm" />
                        <div>
                          <div style={{ fontWeight: 600 }}>{e.full_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{e.department} · {e.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge status={e.emp_type}>{e.emp_type === 'permanent' ? 'Permanent' : 'Part-Time'}</Badge></td>
                    <td>
                      <strong>
                        {e.salary_type === 'hourly'
                          ? `${formatCurrency(e.hourly_rate || 0)}/hr`
                          : formatCurrency(e.monthly_salary || 0)}
                      </strong>
                    </td>
                    <td className="muted">{formatDate(e.joining_date)}</td>
                    <td><Badge status={e.active ? 'active' : 'inactive'} dot /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button variant="ghost"   size="xs" onClick={() => { setSelectedEmp(e); if (e.emp_type === 'part-time') loadEmpAssignments(e.id); }}>View</Button>
                        <Button variant="outline" size="xs" onClick={() => openEdit(e)}>Edit</Button>
                        <Button variant="ghost"   size="xs" style={{ color: 'var(--danger)' }} onClick={() => setDeleteConfirm(e)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} pageSize={perPage} onChange={setPage} label="employees" />
        </div>

        {/* Employee Profile Modal */}
        <Modal open={!!selectedEmp} onClose={() => { setSelectedEmp(null); setEmpAssignments([]); }} title="Employee Profile"
          footer={<>
            <Button variant="ghost" onClick={() => { setSelectedEmp(null); setEmpAssignments([]); }}>Close</Button>
            <Button variant="outline" onClick={() => { if (selectedEmp) { openEdit(selectedEmp); setSelectedEmp(null); } }}>Edit Profile</Button>
          </>}
        >
          {selectedEmp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg)', borderRadius: 10, padding: 16 }}>
                <Avatar name={selectedEmp.full_name} size="lg" />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedEmp.full_name}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{selectedEmp.employee_code} · {selectedEmp.department}</div>
                  <Badge status={selectedEmp.active ? 'active' : 'inactive'} dot />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { l: 'Type', v: selectedEmp.emp_type === 'part-time' ? 'Part-Time' : 'Permanent' },
                  { l: 'Salary', v: selectedEmp.salary_type === 'hourly' ? `${formatCurrency(selectedEmp.hourly_rate || 0)}/hr` : formatCurrency(selectedEmp.monthly_salary || 0) },
                  { l: 'Department', v: selectedEmp.department },
                  { l: 'Designation', v: selectedEmp.designation || '—' },
                  { l: 'Email', v: selectedEmp.email || '—' },
                  { l: 'Mobile', v: selectedEmp.mobile || '—' },
                  { l: 'WhatsApp', v: selectedEmp.whatsapp || '—' },
                  { l: 'Joined', v: formatDate(selectedEmp.joining_date) },
                  { l: 'ID Type', v: selectedEmp.id_type ? (selectedEmp.id_type === 'iqama' ? 'Iqama' : selectedEmp.id_type === 'passport' ? 'Passport' : 'National ID') : '—' },
                  { l: 'ID Number', v: selectedEmp.id_number || '—' },
                  { l: 'ID Expiry', v: selectedEmp.id_expiry ? formatDate(selectedEmp.id_expiry) : '—' },
                ].map(({ l, v }) => (
                  <div key={l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Project assignments — part-time only */}
              {selectedEmp.emp_type === 'part-time' && (() => {
                const activeAss = empAssignments.filter(a => a.active);
                return (
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Project Assignments
                    </div>
                    {assLoading ? (
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading...</div>
                    ) : activeAss.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Not assigned to any project yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {activeAss.map(a => (
                          <div key={a.id} style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 8, padding: '6px 12px' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>{a.project?.project_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {formatCurrency(a.rate)} / {RATE_TYPE_LABEL[a.rate_type] || a.rate_type}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedEmp.notes && (
                <div style={{ background: 'var(--warning-bg)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-2)' }}>
                  <strong>Notes:</strong> {selectedEmp.notes}
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Add/Edit Modal */}
        <Modal
          open={showAdd}
          onClose={closeModal}
          title={editEmp ? 'Edit Employee' : 'Add New Employee'}
          maxWidth={600}
          footer={<>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button loading={submitting} onClick={handleSubmit(onSubmit)}>{editEmp ? 'Save Changes' : 'Create Employee'}</Button>
          </>}
        >
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className={`form-input ${errors.full_name ? 'error' : ''}`} placeholder="John Doe" {...register('full_name')} />
                {errors.full_name && <span className="form-error">{errors.full_name.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className={`form-input ${errors.email ? 'error' : ''}`} type="email" placeholder="john@nsc.com" {...register('email')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mobile</label>
                <input className="form-input" placeholder="+966 5XXXXXXXX" {...register('mobile')} />
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp</label>
                <input className="form-input" placeholder="+966 5XXXXXXXX" {...register('whatsapp')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select className={`form-select ${errors.department ? 'error' : ''}`} {...register('department')}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d}>{d}</option>)}
                </select>
                {errors.department && <span className="form-error">{errors.department.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input className="form-input" placeholder="Software Engineer" {...register('designation')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Employee Type *</label>
                <select className="form-select" {...register('emp_type')}>
                  <option value="permanent">Permanent</option>
                  <option value="part-time">Part-Time</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Salary Type *</label>
                <select className="form-select" {...register('salary_type')}>
                  <option value="monthly">Monthly Salary</option>
                  <option value="hourly">Hourly Rate</option>
                  <option value="fixed">Fixed Contract</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              {salaryType === 'hourly' ? (
                <div className="form-group">
                  <label className="form-label">Hourly Rate (SAR)</label>
                  <input className="form-input" type="number" placeholder="200" {...register('hourly_rate')} />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Monthly Salary (SAR)</label>
                  <input className="form-input" type="number" placeholder="45000" {...register('monthly_salary')} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Joining Date *</label>
                <input className={`form-input ${errors.joining_date ? 'error' : ''}`} type="date" {...register('joining_date')} />
                {errors.joining_date && <span className="form-error">{errors.joining_date.message}</span>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" placeholder="City, State" {...register('address')} />
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-2)' }}>Identity Document</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ID Type</label>
                  <select className="form-select" {...register('id_type')}>
                    <option value="">Select type</option>
                    <option value="iqama">Iqama</option>
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ID Number</label>
                  <input className="form-input" placeholder="e.g. 2xxxxxxxxx" {...register('id_number')} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input className="form-input" type="date" {...register('id_expiry')} />
                </div>
                <div className="form-group" />
              </div>
            </div>
            {!editEmp && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-2)' }}>Login Credentials (optional)</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input className={`form-input ${errors.username ? 'error' : ''}`} placeholder="john.doe" {...register('username')} />
                    {errors.username && <span className="form-error">{errors.username.message}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className={`form-input ${errors.password ? 'error' : ''}`} type="password" placeholder="min 6 chars" {...register('password')} />
                    {errors.password && <span className="form-error">{errors.password.message}</span>}
                  </div>
                </div>
              </div>
            )}
            {/* ── Project Assignment — only for part-time ── */}
            {empType === 'part-time' && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                    Project Assignments
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>(optional)</span>
                  </div>
                </div>

                {/* Existing assignments */}
                {editEmp && (
                  assLoading ? (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Loading assignments...</div>
                  ) : empAssignments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {empAssignments.map(a => (
                        <div key={a.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: a.active ? 'var(--primary-light)' : 'var(--surface)',
                          border: `1px solid ${a.active ? 'var(--primary)' : 'var(--border-2)'}`,
                          borderRadius: 8, padding: '8px 12px',
                          opacity: a.active ? 1 : 0.55,
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: a.active ? 'var(--primary)' : 'var(--text-2)' }}>
                              {a.project?.project_name || a.project_id}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {formatCurrency(a.rate)} / {RATE_TYPE_LABEL[a.rate_type] || a.rate_type}
                              {!a.active && ' · Deactivated'}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => handleRemoveAssignment(a.id, editEmp.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                      No projects assigned yet.
                    </div>
                  )
                )}

                {!editEmp && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                    You can assign projects after creating the employee.
                  </div>
                )}

                {/* Add new assignment row (only for existing part-time employee) */}
                {editEmp && (
                  (() => {
                    const assignedIds = new Set(empAssignments.filter(a => a.active).map(a => a.project_id));
                    const available   = projects.filter(p => !assignedIds.has(p.id));
                    return available.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-2)', paddingTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>Assign to Project</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center' }}>
                          <select
                            className="form-select"
                            value={assProjectId}
                            onChange={e => setAssProjectId(e.target.value)}
                          >
                            <option value="">Select project...</option>
                            {available.map(p => (
                              <option key={p.id} value={p.id}>{p.project_name}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Rate"
                            min="0"
                            step="0.01"
                            value={assRate}
                            onChange={e => setAssRate(e.target.value)}
                            style={{ width: 90 }}
                          />
                          <select
                            className="form-select"
                            value={assRateType}
                            onChange={e => setAssRateType(e.target.value)}
                            style={{ width: 100 }}
                          >
                            <option value="per_unit">Per Unit</option>
                            <option value="per_hour">Per Hour</option>
                            <option value="per_day">Per Day</option>
                            <option value="fixed">Fixed</option>
                          </select>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={addingAss}
                            onClick={() => handleAddAssignment(editEmp.id)}
                          >
                            Assign
                          </Button>
                        </div>
                        {assRate && Number(assRate) > 0 && assProjectId && (
                          <div style={{ fontSize: 12, color: 'var(--primary)' }}>
                            Salary = quantity × {formatCurrency(Number(assRate))} per {RATE_TYPE_LABEL[assRateType]?.toLowerCase() || assRateType}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', borderTop: '1px solid var(--border-2)', paddingTop: 8 }}>
                        All active projects are already assigned.
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
              <textarea className="form-textarea" rows={2} placeholder="Any notes about this employee..." {...register('notes')} />
            </div>
          </form>
        </Modal>

        {/* Delete Confirm */}
        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Deactivate Employee"
          footer={<>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Deactivate</Button>
          </>}
        >
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            ⚠️ This will deactivate {deleteConfirm?.full_name}. They will lose access to the system.
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
            The employee record will be preserved for payroll history. You can reactivate later by editing.
          </p>
        </Modal>
      </div>
    </>
  );
}
