import { ReactNode } from 'react';

interface HeadingProps {
  level?: 1 | 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}

const sizeStyles = {
  1: 'text-3xl font-semibold',
  2: 'text-2xl font-semibold',
  3: 'text-xl font-semibold',
  4: 'text-base font-semibold',
};

export function Heading({ level = 2, children, className }: HeadingProps) {
  const baseStyles = `text-[var(--color-text)] ${sizeStyles[level]}`;
  const combined = `${baseStyles} ${className || ''}`;

  if (level === 1) {
    return <h1 className={combined}>{children}</h1>;
  } else if (level === 2) {
    return <h2 className={combined}>{children}</h2>;
  } else if (level === 3) {
    return <h3 className={combined}>{children}</h3>;
  } else {
    return <h4 className={combined}>{children}</h4>;
  }
}

interface ParagraphProps {
  children: ReactNode;
  muted?: boolean;
  small?: boolean;
  className?: string;
}

export function Paragraph({ children, muted, small, className }: ParagraphProps) {
  const textColor = muted ? 'text-[var(--color-muted-text)]' : 'text-[var(--color-text)]';
  const textSize = small ? 'text-sm' : 'text-base';
  const combined = `${textSize} ${textColor} ${className || ''}`;

  return <p className={combined}>{children}</p>;
}
