import { SelectHTMLAttributes, ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({ label, className, children, ...props }: SelectProps) {
  const baseStyles =
    'rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]';
  const combined = `${baseStyles} ${className || ''}`;

  return (
    <>
      {label && <label className="block text-xs font-medium text-[var(--color-muted-text)] mb-1">{label}</label>}
      <select className={combined} {...props}>
        {children}
      </select>
    </>
  );
}
