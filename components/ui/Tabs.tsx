'use client';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <div key={t.key} className={`tab ${active === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count !== undefined && (
            <span style={{
              marginLeft: 6,
              background: active === t.key ? 'var(--primary)' : 'var(--border)',
              color: active === t.key ? '#fff' : 'var(--text-2)',
              borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
            }}>
              {t.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
