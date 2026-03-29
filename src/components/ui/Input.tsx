import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  const baseStyles =
    'rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]';
  const combined = `${baseStyles} ${className || ''}`;

  return (
    <>
      {label && <label className="block text-xs font-medium text-[var(--color-muted-text)] mb-1">{label}</label>}
      <input className={combined} {...props} />
    </>
  );
}
