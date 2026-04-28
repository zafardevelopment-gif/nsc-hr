'use client';
import { getStatusColor } from '@/lib/utils';

interface BadgeProps {
  status?: string;
  children?: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ status, children, dot, className = '' }: BadgeProps) {
  const cls = getStatusColor(status || '');
  return (
    <span className={`badge ${cls} ${className}`}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />}
      {children || status}
    </span>
  );
}
