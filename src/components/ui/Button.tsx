import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-cta)] text-white hover:brightness-95',
  secondary: 'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]',
  tertiary: 'text-[var(--color-muted-text)] hover:bg-[var(--color-surface-muted)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs font-medium',
  md: 'px-4 py-2 text-sm font-semibold',
  lg: 'px-6 py-3 text-base font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'rounded-xl transition disabled:cursor-not-allowed disabled:opacity-60';
  const combined = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`;

  return (
    <button className={combined} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
