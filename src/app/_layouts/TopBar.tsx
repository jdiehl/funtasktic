'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMvpAuth } from '@/hooks/useMvpAuth';
import { Button, Heading } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';

interface TopBarProps {
  onMenuToggle?: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { user, handleSignOut } = useMvpAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!user) return null;

  const handleSignOutClick = async () => {
    await handleSignOut();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[var(--color-border)] shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Menu button and branding */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-[var(--color-surface-muted)] transition"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/home" className="flex items-center gap-2 hover:opacity-75 transition">
              <h1 className="text-xl font-bold text-[var(--color-text)]">Funtasktic</h1>
            </Link>
          </div>

          {/* Right: User menu */}
          <div className="relative flex items-center gap-3">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg p-2 hover:bg-[var(--color-surface-muted)] transition"
              aria-label="User menu"
            >
              <UserAvatar name={user.displayName ?? user.email ?? 'You'} photoUrl={user.photoURL} size="sm" />
              <span className="hidden sm:inline text-sm font-medium text-[var(--color-text)]">
                {user.displayName ?? user.email}
              </span>
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white border border-[var(--color-border)] shadow-lg overflow-hidden z-50">
                <div className="p-3 border-b border-[var(--color-border)]">
                  <p className="text-sm font-medium text-[var(--color-text)]">{user.displayName ?? 'User'}</p>
                  <p className="text-xs text-[var(--color-muted-text)]">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleSignOutClick();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
