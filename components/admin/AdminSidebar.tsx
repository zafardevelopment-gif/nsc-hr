'use client';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { User } from '@/types';
import toast from 'react-hot-toast';

// Role helpers
// super_admin : full access
// admin       : no Finance
// staff       : only Work Entries, Leave — no Finance, no Payroll, no Reports, no Settings, no Projects management

type NavItem =
  | { section: string; minRole?: 'super_admin' | 'admin' | 'staff' }
  | { href: string; icon: string; label: string; minRole?: 'super_admin' | 'admin' | 'staff' };

const ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/dashboard',         icon: '📊', label: 'Dashboard' },
  { href: '/admin/employees',         icon: '👥', label: 'Employees',   minRole: 'admin' },
  { section: 'Projects',                                                  minRole: 'admin' },
  { href: '/admin/projects',          icon: '📁', label: 'Projects',    minRole: 'admin' },
  { href: '/admin/project-work-logs', icon: '📋', label: 'Work Logs',   minRole: 'admin' },
  { section: 'Operations' },
  { href: '/admin/work-approval',     icon: '⏱️', label: 'Work Entries' },
  { href: '/admin/leave',             icon: '🗓️', label: 'Leave' },
  { href: '/admin/adjustments',       icon: '🧾', label: 'Adjustments', minRole: 'admin' },
  { href: '/admin/payroll',           icon: '💰', label: 'Payroll',     minRole: 'admin' },
  { href: '/admin/documents',         icon: '🪪', label: 'ID Documents',minRole: 'admin' },
  { href: '/admin/finance',           icon: '💵', label: 'Finance',     minRole: 'super_admin' },
  { section: 'Insights',                                                  minRole: 'admin' },
  { href: '/admin/reports',           icon: '📈', label: 'Reports',     minRole: 'admin' },
  { href: '/admin/notifications',     icon: '🔔', label: 'Notifications' },
  { href: '/admin/settings',          icon: '⚙️', label: 'Settings',    minRole: 'super_admin' },
];

const ROLE_RANK: Record<string, number> = { super_admin: 3, admin: 2, staff: 1 };

function getRoleRank(user: User): number {
  return ROLE_RANK[user.role_type || 'super_admin'] ?? 3;
}

function canAccess(user: User, minRole?: string): boolean {
  if (!minRole) return true;
  return getRoleRank(user) >= (ROLE_RANK[minRole] ?? 0);
}

function getVisibleItems(user: User): NavItem[] {
  return ADMIN_ITEMS.filter(item => canAccess(user, 'minRole' in item ? item.minRole : undefined));
}

function getRoleLabel(user: User): string {
  const rt = user.role_type || 'super_admin';
  if (rt === 'super_admin') return 'Super Admin';
  if (rt === 'admin') return 'Admin';
  return 'Staff';
}

type MobileNavItem = { href: string; icon: string; label: string; minRole?: string };

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { href: '/admin/dashboard',    icon: '📊', label: 'Dashboard' },
  { href: '/admin/employees',    icon: '👥', label: 'Staff',    minRole: 'admin' },
  { href: '/admin/finance',      icon: '💵', label: 'Finance',  minRole: 'super_admin' },
  { href: '/admin/projects',     icon: '📁', label: 'Projects', minRole: 'admin' },
  { href: '/admin/payroll',      icon: '💰', label: 'Payroll',  minRole: 'admin' },
  { href: '/admin/reports',      icon: '📈', label: 'Reports',  minRole: 'admin' },
  { href: '__logout__',          icon: '⎋',  label: 'Logout' },
];

interface AdminSidebarProps { user: User; }

export function AdminMobileNav({ user }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push('/login');
  }

  const visibleItems = MOBILE_NAV_ITEMS.filter(item => canAccess(user, item.minRole));

  return (
    <div className="mobile-nav">
      {visibleItems.map(item => (
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
        <img
          src="/nsc-logo.png"
          alt="NSC"
          style={{ height: 36, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div>
          <div className="sidebar-logo-text">NSC Employee</div>
          <div className="sidebar-logo-sub">Admin Panel</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {getVisibleItems(user).map((item, i) => {
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
            <div className="sidebar-user-role">{getRoleLabel(user)}</div>
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
