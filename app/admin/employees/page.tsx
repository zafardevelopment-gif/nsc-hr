'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Progress } from '@/components/ui/Progress';
import { useUser } from '@/lib/hooks';
import { Employee } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
  notes: z.string().optional(),
  username: z.string().min(3, 'Username min 3 chars').optional().or(z.literal('')),
  password: z.string().min(6, 'Password min 6 chars').optional().or(z.literal('')),
});

type EmpForm = z.infer<typeof empSchema>;

const DEPARTMENTS = ['Engineering', 'Design', 'Sales', 'HR', 'Finance', 'Marketing', 'Operations', 'Management'];

export default function EmployeesPage() {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
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
  const empType = watch('emp_type');
  const salaryType = watch('salary_type');

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
      notes: emp.notes || '',
    });
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
        actions={<Button onClick={() => { setEditEmp(null); reset({ emp_type: 'permanent', salary_type: 'monthly' }); setShowAdd(true); }} icon="＋">Add Employee</Button>}
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
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
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
                        <Button variant="ghost"   size="xs" onClick={() => setSelectedEmp(e)}>View</Button>
                        <Button variant="outline" size="xs" onClick={() => openEdit(e)}>Edit</Button>
                        <Button variant="ghost"   size="xs" style={{ color: 'var(--danger)' }} onClick={() => setDeleteConfirm(e)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-2)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} employees
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`pagination-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              </div>
            )}
          </div>
        </div>

        {/* Employee Profile Modal */}
        <Modal open={!!selectedEmp} onClose={() => setSelectedEmp(null)} title="Employee Profile"
          footer={<>
            <Button variant="ghost" onClick={() => setSelectedEmp(null)}>Close</Button>
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
                  { l: 'Type', v: selectedEmp.emp_type },
                  { l: 'Salary', v: selectedEmp.salary_type === 'hourly' ? `${formatCurrency(selectedEmp.hourly_rate || 0)}/hr` : formatCurrency(selectedEmp.monthly_salary || 0) },
                  { l: 'Department', v: selectedEmp.department },
                  { l: 'Designation', v: selectedEmp.designation || '—' },
                  { l: 'Email', v: selectedEmp.email || '—' },
                  { l: 'Mobile', v: selectedEmp.mobile || '—' },
                  { l: 'WhatsApp', v: selectedEmp.whatsapp || '—' },
                  { l: 'Joined', v: formatDate(selectedEmp.joining_date) },
                ].map(({ l, v }) => (
                  <div key={l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>
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
          onClose={() => { setShowAdd(false); setEditEmp(null); reset(); }}
          title={editEmp ? 'Edit Employee' : 'Add New Employee'}
          maxWidth={600}
          footer={<>
            <Button variant="ghost" onClick={() => { setShowAdd(false); setEditEmp(null); reset(); }}>Cancel</Button>
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
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
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
