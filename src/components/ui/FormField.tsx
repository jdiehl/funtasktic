import { ReactNode } from 'react';

interface FormFieldProps {
  label?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, error, children, className }: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className || ''}`}>
      {label && <label className="text-xs font-medium text-[var(--color-muted-text)]">{label}</label>}
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
