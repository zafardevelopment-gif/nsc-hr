'use client';
import { useState, useEffect } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useUser } from '@/lib/hooks';
import { Notification } from '@/types';
import { timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Employee { id: string; full_name: string; employee_code: string; department: string | null; }

const NOTIF_ICONS: Record<string, string> = {
  salary: '💰', leave: '🗓️', work: '⏱️', announcement: '📢', payment: '💳', default: '🔔',
};

function getIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('salary') || t.includes('payroll')) return NOTIF_ICONS.salary;
  if (t.includes('leave')) return NOTIF_ICONS.leave;
  if (t.includes('work') || t.includes('entry')) return NOTIF_ICONS.work;
  if (t.includes('payment')) return NOTIF_ICONS.payment;
  if (t.includes('announcement') || t.includes('holiday')) return NOTIF_ICONS.announcement;
  return NOTIF_ICONS.default;
}

type RecipientMode = 'all' | 'employee' | 'admin' | 'department' | 'specific';

export default function NotificationsPage() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Compose state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notifType, setNotifType] = useState('in-app');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [empSearch, setEmpSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [notifRes, empRes, deptRes] = await Promise.all([
          fetch('/api/notifications'),
          fetch('/api/employees?limit=500'),
          fetch('/api/departments'),
        ]);
        const [notifJson, empJson, deptJson] = await Promise.all([
          notifRes.json(), empRes.json(), deptRes.json(),
        ]);
        setNotifications(notifJson.data || []);
        setEmployees(empJson.data || []);
        setDepartments((deptJson.data || []).map((d: { name: string }) => d.name));
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function refreshNotifs() {
    const res = await fetch('/api/notifications');
    const json = await res.json();
    setNotifications(json.data || []);
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
    toast.success('All marked as read');
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PUT' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_status: true } : n));
  }

  function toggleEmp(id: string) {
    setSelectedEmps(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  }

  function selectAllDeptEmps() {
    const deptEmps = employees.filter(e => e.department === selectedDept).map(e => e.id);
    setSelectedEmps(deptEmps);
  }

  async function send() {
    if (!title.trim() || !message.trim()) { toast.error('Title and message required'); return; }

    if (recipientMode === 'department' && !selectedDept) { toast.error('Select a department'); return; }
    if (recipientMode === 'specific' && selectedEmps.length === 0) { toast.error('Select at least one employee'); return; }

    setSending(true);
    try {
      let body: Record<string, unknown>;

      if (recipientMode === 'department') {
        // Send to all employees in selected department
        const deptEmpIds = employees
          .filter(e => e.department === selectedDept)
          .map(e => e.id);
        if (deptEmpIds.length === 0) { toast.error('No employees in this department'); setSending(false); return; }
        body = { title, message, notification_type: notifType, employee_ids: deptEmpIds };
      } else if (recipientMode === 'specific') {
        body = { title, message, notification_type: notifType, employee_ids: selectedEmps };
      } else {
        body = { title, message, notification_type: notifType, target_role: recipientMode };
      }

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Notification sent!');
      setTitle(''); setMessage(''); setRecipientMode('all');
      setSelectedDept(''); setSelectedEmps([]); setEmpSearch('');
      await refreshNotifs();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const unread = notifications.filter(n => !n.read_status).length;

  // Employees shown in specific selector — filter by search
  const filteredEmps = employees.filter(e => {
    if (!empSearch) return true;
    const q = empSearch.toLowerCase();
    return e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q) || (e.department || '').toLowerCase().includes(q);
  });

  // Recipients summary label
  function recipientLabel() {
    if (recipientMode === 'all') return 'All Employees';
    if (recipientMode === 'employee') return 'Employees Only';
    if (recipientMode === 'admin') return 'Admins Only';
    if (recipientMode === 'department') return selectedDept ? `${selectedDept} Department` : 'Select Department';
    if (recipientMode === 'specific') return selectedEmps.length > 0 ? `${selectedEmps.length} employee(s) selected` : 'Select Employees';
    return '';
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Notifications" user={user} unreadCount={unread} />
      <div className="page-content">

        {/* Compose */}
        <Card title="Send Notification">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Row 1: Title + Notif Type */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" placeholder="e.g. Holiday Announcement" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Notification Type</label>
                <select className="form-select" value={notifType} onChange={e => setNotifType(e.target.value)}>
                  <option value="in-app">In-App Only</option>
                  <option value="whatsapp">WhatsApp Only</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>

            {/* Row 2: Recipient Mode */}
            <div className="form-group">
              <label className="form-label">Send To</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {([
                  { value: 'all',        label: 'All Employees' },
                  { value: 'department', label: 'By Department' },
                  { value: 'specific',   label: 'Specific Employee' },
                ] as { value: RecipientMode; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    className={`chip ${recipientMode === opt.value ? 'active' : ''}`}
                    onClick={() => { setRecipientMode(opt.value); setSelectedDept(''); setSelectedEmps([]); setEmpSearch(''); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Department selector */}
            {recipientMode === 'department' && (
              <div className="form-group">
                <label className="form-label">Select Department</label>
                <select className="form-select" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                  <option value="">-- Choose department --</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {selectedDept && (
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
                    {employees.filter(e => e.department === selectedDept).length} employee(s) in {selectedDept}
                  </div>
                )}
              </div>
            )}

            {/* Specific employee selector */}
            {recipientMode === 'specific' && (
              <div className="form-group">
                <label className="form-label">
                  Select Employees
                  {selectedEmps.length > 0 && (
                    <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--primary)', fontSize: 12 }}>
                      {selectedEmps.length} selected
                      <button
                        style={{ marginLeft: 6, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}
                        onClick={() => setSelectedEmps([])}
                      >clear</button>
                    </span>
                  )}
                </label>
                <input
                  className="form-input"
                  placeholder="Search by name, code or department..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ border: '1px solid var(--border-2)', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {filteredEmps.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>No employees found</div>
                  ) : filteredEmps.map(e => (
                    <label
                      key={e.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
                        background: selectedEmps.includes(e.id) ? 'var(--primary-light)' : 'transparent',
                        borderBottom: '1px solid var(--border-2)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmps.includes(e.id)}
                        onChange={() => toggleEmp(e.id)}
                        style={{ width: 15, height: 15, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{e.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{e.employee_code}{e.department ? ` · ${e.department}` : ''}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Message */}
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                className="form-textarea"
                placeholder="Write your announcement here..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={{ minHeight: 80 }}
              />
            </div>

            {/* Send button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Sending to: <strong>{recipientLabel()}</strong>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(notifType === 'whatsapp' || notifType === 'both') && (
                  <Button variant="ghost" icon="📱" loading={sending} onClick={send}>Send via WhatsApp</Button>
                )}
                {(notifType === 'in-app' || notifType === 'both') && (
                  <Button icon="📢" loading={sending} onClick={send}>Send Notification</Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Feed */}
        <Card
          title={`Notification Feed${unread > 0 ? ` (${unread} unread)` : ''}`}
          actions={unread > 0 ? <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button> : undefined}
          noPadding
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><div>No notifications</div></div>
          ) : notifications.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.read_status ? 'unread' : ''}`}
              onClick={() => !n.read_status && markRead(n.id)}
            >
              <div style={{ fontSize: 24, lineHeight: 1 }}>{getIcon(n.title)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeAgo(n.created_at || '')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{n.message}</div>
                {n.notification_type !== 'in-app' && (
                  <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>📱 {n.notification_type}</span>
                )}
              </div>
              {!n.read_status && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
