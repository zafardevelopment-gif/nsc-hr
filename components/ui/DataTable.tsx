'use client';

interface Column<T> {
  key: string;
  label: string;
  muted?: boolean;
  style?: React.CSSProperties;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  emptyMsg?: string;
  emptyIcon?: string;
}

export function DataTable<T extends Record<string, unknown>>({ columns, rows, emptyMsg = 'No data found', emptyIcon = '📭' }: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c, i) => <th key={i} style={c.style}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-state">
                  <div className="empty-icon">{emptyIcon}</div>
                  <div style={{ fontWeight: 600 }}>{emptyMsg}</div>
                </div>
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c, j) => (
                <td key={j} className={c.muted ? 'muted' : ''} style={c.style}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
