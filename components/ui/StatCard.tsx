'use client';

interface StatCardProps {
  icon: string;
  iconBg?: string;
  label: string;
  value: string | number;
  trend?: string;
  trendDir?: 'up' | 'down';
}

export function StatCard({ icon, iconBg = '#EEF3FD', label, value, trend, trendDir = 'up' }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
        {trend && <span className={`stat-trend ${trendDir}`}>{trendDir === 'up' ? '↑' : '↓'} {trend}</span>}
      </div>
      <div>
        <div className="stat-num">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
