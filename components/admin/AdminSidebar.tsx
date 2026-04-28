'use client';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { User } from '@/types';
import toast from 'react-hot-toast';

const ADMIN_ITEMS = [
  { href: '/admin/dashboard',     icon: '📊', label: 'Dashboard' },
  { href: '/admin/employees',     icon: '👥', label: 'Employees' },
  { section: 'Operations' },
  { href: '/admin/work-approval', icon: '⏱️', label: 'Work Entries' },
  { href: '/admin/leave',         icon: '🗓️', label: 'Leave' },
  { href: '/admin/payroll',       icon: '💰', label: 'Payroll' },
  { section: 'Insights' },
  { href: '/admin/reports',       icon: '📈', label: 'Reports' },
  { href: '/admin/notifications', icon: '🔔', label: 'Notifications' },
  { href: '/admin/settings',      icon: '⚙️', label: 'Settings' },
];

const MOBILE_NAV_ITEMS = [
  { href: '/admin/dashboard',     icon: '📊', label: 'Dashboard' },
  { href: '/admin/employees',     icon: '👥', label: 'Employees' },
  { href: '/admin/work-approval', icon: '⏱️', label: 'Work' },
  { href: '/admin/leave',         icon: '🗓️', label: 'Leave' },
  { href: '/admin/payroll',       icon: '💰', label: 'Payroll' },
  { href: '__logout__',           icon: '⎋',  label: 'Logout' },
];

interface AdminSidebarProps {
  user: User;
}

export function AdminMobileNav({ user }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push('/login');
  }

  return (
    <div className="mobile-nav">
      {MOBILE_NAV_ITEMS.map(item => (
        <div
          key={item.href}
          className={`mobile-nav-item ${pathname === item.href ? 'active' : ''}`}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: 8, cursor: 'pointer', fontSize: 10, fontWeight: 600,
            color: item.href === '__logout__' ? 'var(--danger)'
              : pathname === item.href ? 'var(--primary)'
              : 'var(--text-3)',
          }}
          onClick={() => item.href === '__logout__' ? handleLogout() : router.push(item.href)}
        >
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          {item.label}
        </div>
      ))}
    </div>
  );
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push('/login');
  }

  const displayName = user.employee?.full_name || user.username;

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">N</div>
        <div>
          <div className="sidebar-logo-text">NSC Employee</div>
          <div className="sidebar-logo-sub">Admin Panel</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {ADMIN_ITEMS.map((item, i) => {
          if ('section' in item) {
            return <div key={i} className="sidebar-section">{item.section}</div>;
          }
          const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
          return (
            <div
              key={item.href}
              className={`sidebar-item ${active ? 'active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </div>
          );
        })}
      </div>

      <div className="sidebar-user" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={displayName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div className="sidebar-user-role">Administrator</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <span>⎋</span> Logout
        </button>
      </div>
    </div>
  );
}
