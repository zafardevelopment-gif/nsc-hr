'use client';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { User } from '@/types';

interface EmployeeTopbarProps {
  title: string;
  actions?: React.ReactNode;
  user: User;
  unreadCount?: number;
}

export function EmployeeTopbar({ title, actions, user, unreadCount = 0 }: EmployeeTopbarProps) {
  const router = useRouter();
  const name = user.employee?.full_name || user.username;
  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-right">
        {actions}
        <div className="topbar-icon-btn" onClick={() => router.push('/employee/notifications')} title="Notifications">
          🔔
          {unreadCount > 0 && <div className="notif-dot" />}
        </div>
        <Avatar name={name} />
      </div>
    </div>
  );
}
