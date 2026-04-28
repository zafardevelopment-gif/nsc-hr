'use client';

interface ProgressProps {
  value: number;
  max?: number;
  color?: string;
}

export function Progress({ value, max = 100, color = 'var(--primary)' }: ProgressProps) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
