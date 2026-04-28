export function cn(...inputs: (string | undefined | null | false | 0)[]) {
  return inputs.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number, symbol = '₹'): string {
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
}

export function calcLeaveDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const d1 = new Date(from);
  const d2 = new Date(to);
  const diff = Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

export function generateEmployeeCode(index: number): string {
  return `NSC${String(index).padStart(3, '0')}`;
}

export function getMonthOptions(): { value: string; label: string }[] {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }
  return months;
}

export function getPayrollMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const d = new Date(parseInt(year), parseInt(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function avatarColor(name: string): string {
  const colors = ['#3B6FE8', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#14B8A6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) {
    h = (h + name.charCodeAt(i)) % colors.length;
  }
  return colors[h];
}

export function initials(name: string): string {
  return (name || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-success', approved: 'badge-success', paid: 'badge-success', processed: 'badge-success',
    pending: 'badge-warning', draft: 'badge-warning', generated: 'badge-primary',
    rejected: 'badge-danger', inactive: 'badge-gray', 'on leave': 'badge-warning',
    permanent: 'badge-primary', 'part-time': 'badge-info', hourly: 'badge-info',
  };
  return map[status?.toLowerCase()] || 'badge-gray';
}

export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}
