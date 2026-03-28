'use client';

import React, { useState } from 'react';
import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpInvitePreview } from '@/hooks/useMvpInvitePreview';
import { useAcceptInvite } from '@/hooks/useAcceptInvite';
import { UserAvatar } from '@/components/UserAvatar';

export function MainHeader() {
  const { user, handleSignOut } = useMvpAuth();
  const { invitePreview, inviteToken } = useMvpInvitePreview();
  const { handleAcceptInvite: onAcceptInvite } = useAcceptInvite(user);

  const [busy, setBusy] = useState(false);

  const handleAcceptClick = async () => {
    setBusy(true);
    try {
      if (inviteToken) {
        await onAcceptInvite(inviteToken);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutClick = async () => {
    setBusy(true);
    try {
      await handleSignOut();
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;
  return (
    <header className="mb-6 flex flex-col gap-3 rounded-3xl border border-[var(--color-border)] bg-white/90 p-4 shadow-[0_12px_40px_rgba(13,32,44,0.1)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center gap-3">
        <UserAvatar name={user.displayName ?? user.email ?? 'You'} photoUrl={user.photoURL} />
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Funtasktic</h1>
          <p className="text-sm text-[var(--color-muted-text)]">Recurring chores, fair points, shared momentum.</p>
        </div>
      </div>
      <div className="flex gap-2">
        {invitePreview?.status === 'pending' ? (
          <button
            type="button"
            className="rounded-xl bg-[var(--color-accent-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleAcceptClick}
            disabled={busy}
          >
            Accept invite
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSignOutClick}
          disabled={busy}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
