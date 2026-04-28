'use client';

interface CardProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
}

export function Card({ title, actions, children, className = '', style, noPadding }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {title && (
        <div className="card-header">
          <div className="card-title">{title}</div>
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      {noPadding ? children : <div className="card-body">{children}</div>}
    </div>
  );
}
