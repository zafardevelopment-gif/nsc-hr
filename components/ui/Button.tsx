'use client';
import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'success' | 'danger' | 'whatsapp';
  size?: 'default' | 'sm' | 'xs';
  icon?: string;
  loading?: boolean;
}

export function Button({ variant = 'primary', size, icon, loading, children, className = '', disabled, ...props }: ButtonProps) {
  const varCls = {
    primary: 'btn-primary', outline: 'btn-outline', ghost: 'btn-ghost',
    success: 'btn-success', danger: 'btn-danger', whatsapp: 'whatsapp-btn',
  }[variant];
  const szCls = size === 'sm' ? 'btn-sm' : size === 'xs' ? 'btn-xs' : '';

  return (
    <button className={`btn ${varCls} ${szCls} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : icon && <span>{icon}</span>}
      {children}
    </button>
  );
}
