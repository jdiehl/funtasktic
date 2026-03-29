import { ReactNode } from 'react';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-surface-muted)] text-[var(--color-text)]',
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const baseStyles = 'rounded-full px-2 py-1 text-xs font-semibold';
  const combined = `${baseStyles} ${variantStyles[variant]} ${className || ''}`;

  return <span className={combined}>{children}</span>;
}
