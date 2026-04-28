'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  label?: string;
}

export function Pagination({ page, totalPages, total, pageSize, onChange, label = 'records' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);

  // Show up to 5 page buttons, centered around current page
  const delta = 2;
  const start = Math.max(1, page - delta);
  const end   = Math.min(totalPages, page + delta);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div style={{
      padding: '12px 20px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderTop: '1px solid var(--border-2)',
      flexWrap: 'wrap', gap: 8,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
        Showing {from}–{to} of {total} {label}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="pagination-btn" onClick={() => onChange(1)} disabled={page === 1} title="First">«</button>
        <button className="pagination-btn" onClick={() => onChange(page - 1)} disabled={page === 1}>‹</button>
        {start > 1 && <span style={{ padding: '0 4px', lineHeight: '32px', color: 'var(--text-3)' }}>…</span>}
        {pages.map(p => (
          <button key={p} className={`pagination-btn ${page === p ? 'active' : ''}`} onClick={() => onChange(p)}>{p}</button>
        ))}
        {end < totalPages && <span style={{ padding: '0 4px', lineHeight: '32px', color: 'var(--text-3)' }}>…</span>}
        <button className="pagination-btn" onClick={() => onChange(page + 1)} disabled={page === totalPages}>›</button>
        <button className="pagination-btn" onClick={() => onChange(totalPages)} disabled={page === totalPages} title="Last">»</button>
      </div>
    </div>
  );
}
