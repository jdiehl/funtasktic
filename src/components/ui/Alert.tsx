import { ReactNode } from 'react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  children: ReactNode;
  type?: AlertType;
  className?: string;
}

const typeStyles: Record<AlertType, string> = {
  info: 'bg-[var(--color-surface-muted)] text-[var(--color-text)]',
  success: 'bg-green-50 text-green-900',
  warning: 'bg-yellow-50 text-yellow-900',
  error: 'bg-red-50 text-red-900',
};

export function Alert({ children, type = 'info', className }: AlertProps) {
  const baseStyles = 'rounded-2xl p-4';
  const combined = `${baseStyles} ${typeStyles[type]} ${className || ''}`;

  return <div className={combined}>{children}</div>;
}
