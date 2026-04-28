'use client';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { User } from '@/types';

interface AdminTopbarProps {
  title: string;
  actions?: React.ReactNode;
  user: User;
  unreadCount?: number;
}

export function AdminTopbar({ title, actions, user, unreadCount = 0 }: AdminTopbarProps) {
  const router = useRouter();
  const name = user.employee?.full_name || user.username;

  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-right">
        {actions}
        <div className="topbar-icon-btn" onClick={() => router.push('/admin/notifications')} title="Notifications">
          🔔
          {unreadCount > 0 && <div className="notif-dot" />}
        </div>
        <Avatar name={name} />
      </div>
    </div>
  );
}
