'use client';
import { useState, useEffect } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useUser } from '@/lib/hooks';
import { Notification } from '@/types';
import { timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';

const NOTIF_ICONS: Record<string, string> = {
  salary: '💰', leave: '🗓️', work: '⏱️', announcement: '📢',
  payment: '💳', default: '🔔',
};

function getIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('salary') || t.includes('payroll')) return '💰';
  if (t.includes('leave')) return '🗓️';
  if (t.includes('work') || t.includes('entry')) return '⏱️';
  if (t.includes('payment')) return '💳';
  if (t.includes('announcement') || t.includes('holiday')) return '📢';
  return '🔔';
}

export default function NotificationsPage() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [compose, setCompose] = useState({ title: '', message: '', target_role: 'all', type: 'in-app' });
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

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

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
    toast.success('All marked as read');
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PUT' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_status: true } : n));
  }

  async function send() {
    if (!compose.title || !compose.message) {
      toast.error('Title and message required');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: compose.title,
          message: compose.message,
          target_role: compose.target_role,
          notification_type: compose.type,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Notification sent!');
      setCompose({ title: '', message: '', target_role: 'all', type: 'in-app' });

      // Refresh
      const notifRes = await fetch('/api/notifications');
      const notifJson = await notifRes.json();
      setNotifications(notifJson.data || []);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const unread = notifications.filter(n => !n.read_status).length;

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Notifications" user={user} unreadCount={unread} />
      <div className="page-content">
        {/* Compose */}
        <Card title="Send Broadcast Message">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" placeholder="Notification title" value={compose.title} onChange={e => setCompose(c => ({ ...c, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Recipients</label>
                <select className="form-select" value={compose.target_role} onChange={e => setCompose(c => ({ ...c, target_role: e.target.value }))}>
                  <option value="all">All Employees</option>
                  <option value="employee">Employees Only</option>
                  <option value="admin">Admins Only</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Notification Type</label>
                <select className="form-select" value={compose.type} onChange={e => setCompose(c => ({ ...c, type: e.target.value }))}>
                  <option value="in-app">In-App Only</option>
                  <option value="whatsapp">WhatsApp Only</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-textarea" placeholder="Write your announcement here..." value={compose.message} onChange={e => setCompose(c => ({ ...c, message: e.target.value }))} style={{ minHeight: 70 }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {(compose.type === 'whatsapp' || compose.type === 'both') && (
                <Button variant="whatsapp" icon="📱" loading={sending} onClick={send}>Send via WhatsApp</Button>
              )}
              {(compose.type === 'in-app' || compose.type === 'both') && (
                <Button icon="📢" loading={sending} onClick={send}>Send Notification</Button>
              )}
            </div>
          </div>
        </Card>

        {/* Feed */}
        <Card title={`Notification Feed ${unread > 0 ? `(${unread} unread)` : ''}`}
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
