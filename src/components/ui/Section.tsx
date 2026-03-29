import { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
}

export function Section({ children, className }: SectionProps) {
  const baseStyles = 'mb-6 grid gap-4 rounded-3xl border border-[var(--color-border)] bg-white/90 p-4 sm:p-5';
  const combined = `${baseStyles} ${className || ''}`;

  return <section className={combined}>{children}</section>;
}
