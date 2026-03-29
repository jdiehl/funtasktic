import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  shadow?: boolean;
}

export function Card({ children, className, shadow = true }: CardProps) {
  const shadowClass = shadow ? 'shadow-[0_8px_24px_rgba(13,32,44,0.06)]' : '';
  const baseStyles = `rounded-2xl border border-[var(--color-border)] bg-white p-4 ${shadowClass}`;
  const combined = `${baseStyles} ${className || ''}`;

  return <article className={combined}>{children}</article>;
}
