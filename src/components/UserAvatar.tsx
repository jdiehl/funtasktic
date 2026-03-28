import Image from 'next/image';

interface UserAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md';
}

const avatarSizeClass: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
};

const avatarPixelSize: Record<NonNullable<UserAvatarProps['size']>, number> = {
  sm: 32,
  md: 40,
};

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return '?';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function UserAvatar({ name, photoUrl, size = 'md' }: UserAvatarProps) {
  const classes = avatarSizeClass[size];
  const pixelSize = avatarPixelSize[size];

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={`${name} avatar`}
        width={pixelSize}
        height={pixelSize}
        unoptimized
        className={`${classes} rounded-full object-cover ring-2 ring-white/70`}
      />
    );
  }

  return (
    <div
      aria-label={`${name} avatar`}
      className={`${classes} inline-flex items-center justify-center rounded-full bg-[var(--color-accent-strong)] font-semibold text-white ring-2 ring-white/70`}
    >
      {initialsFromName(name)}
    </div>
  );
}
