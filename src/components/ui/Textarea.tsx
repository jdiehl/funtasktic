import { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, ...props }: TextareaProps) {
  const baseStyles =
    'rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]';
  const combined = `${baseStyles} ${className || ''}`;

  return (
    <>
      {label && <label className="block text-xs font-medium text-[var(--color-muted-text)] mb-1">{label}</label>}
      <textarea className={combined} {...props} />
    </>
  );
}
