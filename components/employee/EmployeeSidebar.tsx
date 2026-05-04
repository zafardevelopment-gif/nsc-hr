'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { User } from '@/types';
import toast from 'react-hot-toast';

const EMP_ITEMS = [
  { href: '/employee/dashboard',     icon: '🏠', label: 'My Dashboard' },
  { href: '/employee/work-entry',    icon: '⏱️', label: 'Work Entry' },
  { href: '/employee/leave',         icon: '🗓️', label: 'Leave' },
  { href: '/employee/salary',        icon: '📊', label: 'My Salary' },
  { href: '/employee/payslip',       icon: '💰', label: 'Payslips' },
  { href: '/employee/documents',     icon: '🪪', label: 'My Documents' },
  { href: '/employee/notifications', icon: '🔔', label: 'Notifications' },
];

export function EmployeeSidebar({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSubmitting, setPwSubmitting] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push('/login');
  }

  async function handleChangePassword() {
    if (!pwForm.currentPassword || !pwForm.newPassword) { toast.error('All fields are required'); return; }
    if (pwForm.newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    setPwSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success('Password changed successfully');
      setShowChangePw(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to change password');
    } finally {
      setPwSubmitting(false);
    }
  }

  const displayName = user.employee?.full_name || user.username;

  return (
    <>
      <div className="sidebar">
        <div className="sidebar-logo">
          <img
            src="/nsc-logo.png"
            alt="NSC"
            style={{ height: 36, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <div className="sidebar-logo-text">NSC Employee</div>
            <div className="sidebar-logo-sub">Employee Portal</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '8px 0' }}>
          {EMP_ITEMS.map(item => {
            const active = pathname === item.href;
            return (
              <div key={item.href} className={`sidebar-item ${active ? 'active' : ''}`} onClick={() => router.push(item.href)}>
                <span className="icon">{item.icon}</span>
                {item.label}
              </div>
            );
          })}
        </div>

        <div className="sidebar-user" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={displayName} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div className="sidebar-user-role">{user.employee?.designation || 'Employee'}</div>
            </div>
          </div>
          <button
            onClick={() => setShowChangePw(true)}
            style={{ width: '100%', padding: '7px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            🔑 Change Password
          </button>
          <button onClick={handleLogout}
            style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span>⎋</span> Logout
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        open={showChangePw}
        onClose={() => { setShowChangePw(false); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}
        title="Change Password"
        footer={<>
          <Button variant="ghost" onClick={() => { setShowChangePw(false); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>Cancel</Button>
          <Button loading={pwSubmitting} onClick={handleChangePassword}>Update Password</Button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input className="form-input" type="password" placeholder="Enter your current password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" placeholder="Minimum 6 characters" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input className="form-input" type="password" placeholder="Repeat new password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleChangePassword()} />
          </div>
        </div>
      </Modal>
    </>
  );
}

export function EmployeeMobileNav({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push('/login');
  }

  async function handleChangePassword() {
    if (!pwForm.currentPassword || !pwForm.newPassword) { toast.error('All fields are required'); return; }
    if (pwForm.newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    setPwSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success('Password changed successfully');
      setShowChangePw(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to change password');
    } finally {
      setPwSubmitting(false);
    }
  }

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const displayName = user.employee?.full_name || user.username;

  return (
    <>
      {/* Hamburger button */}
      <button
        className="mobile-hamburger"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <span />
        <span />
        <span />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`mobile-drawer ${open ? 'open' : ''}`}>
        {/* Header */}
        <div className="mobile-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/nsc-logo.png"
              alt="NSC"
              style={{ height: 32, width: 'auto', objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>NSC Employee</div>
              <div style={{ fontSize: 10, color: 'var(--primary-dark)', opacity: 0.7 }}>Employee Portal</div>
            </div>
          </div>
          <button className="mobile-drawer-close" onClick={() => setOpen(false)}>✕</button>
        </div>

        {/* User info */}
        <div className="mobile-drawer-user">
          <Avatar name={displayName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{user.employee?.designation || 'Employee'}</div>
          </div>
        </div>

        {/* Nav items */}
        <div className="mobile-drawer-nav">
          {EMP_ITEMS.map(item => {
            const active = pathname === item.href;
            return (
              <div
                key={item.href}
                className={`sidebar-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.href)}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </div>
            );
          })}
        </div>

        {/* Logout */}
        <div className="mobile-drawer-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => { setOpen(false); setShowChangePw(true); }}
            style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            🔑 Change Password
          </button>
          <button
            onClick={handleLogout}
            style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <span>⎋</span> Logout
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        open={showChangePw}
        onClose={() => { setShowChangePw(false); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}
        title="Change Password"
        footer={<>
          <Button variant="ghost" onClick={() => { setShowChangePw(false); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>Cancel</Button>
          <Button loading={pwSubmitting} onClick={handleChangePassword}>Update Password</Button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input className="form-input" type="password" placeholder="Enter your current password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" placeholder="Minimum 6 characters" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input className="form-input" type="password" placeholder="Repeat new password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleChangePassword()} />
          </div>
        </div>
      </Modal>
    </>
  );
}
