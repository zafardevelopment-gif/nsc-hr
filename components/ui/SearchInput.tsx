'use client';

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}

export function SearchInput({ placeholder = 'Search...', value, onChange }: SearchInputProps) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', fontSize: 14 }}>🔍</span>
      <input
        className="form-input"
        style={{ paddingLeft: 34 }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
