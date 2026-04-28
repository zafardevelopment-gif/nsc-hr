'use client';
import { useState, useEffect } from 'react';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useUser } from '@/lib/hooks';
import { Notification } from '@/types';
import { timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';

function getIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('salary') || t.includes('payroll')) return '💰';
  if (t.includes('leave')) return '🗓️';
  if (t.includes('work') || t.includes('entry')) return '⏱️';
  if (t.includes('payment')) return '💳';
  if (t.includes('announcement') || t.includes('holiday')) return '📢';
  return '🔔';
}

export default function EmpNotificationsPage() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notification | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/notifications');
        const json = await res.json();
        setNotifications(json.data || []);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function markRead(n: Notification) {
    if (!n.read_status) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PUT' });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_status: true } : x));
    }
    setSelected(n);
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
    toast.success('All marked as read');
  }

  const unread = notifications.filter(n => !n.read_status).length;

  if (!user) return null;

  return (
    <>
      <EmployeeTopbar title="Notifications" user={user} unreadCount={unread} />
      <div className="page-content">
        {selected && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{getIcon(selected.title)}</span>
                <div>
                  <div className="card-title">{selected.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{timeAgo(selected.created_at || '')}</div>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{selected.message}</p>
            </div>
          </div>
        )}

        <Card
          title={`All Notifications ${unread > 0 ? `(${unread} unread)` : ''}`}
          actions={unread > 0 ? <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button> : undefined}
          noPadding
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><div>No notifications</div></div>
          ) : notifications.map(n => (
            <div key={n.id} className={`notif-item ${!n.read_status ? 'unread' : ''}`} onClick={() => markRead(n)}>
              <div style={{ fontSize: 24, lineHeight: 1 }}>{getIcon(n.title)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeAgo(n.created_at || '')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{n.message}</div>
              </div>
              {!n.read_status && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
