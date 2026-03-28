'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpInvitePreview } from '@/hooks/useMvpInvitePreview';

export function AuthSection() {
  const {
    displayName,
    email,
    password,
    authBusy,
    message,
    setDisplayName,
    setEmail,
    setPassword,
    handleSignIn,
    handleSignUp,
  } = useMvpAuth();

  const { invitePreview } = useMvpInvitePreview();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10">
      <section className="w-full rounded-3xl border border-[var(--color-border)] bg-white/90 p-6 shadow-[0_14px_42px_rgba(13,32,44,0.12)] sm:p-8">
        <h1 className="text-3xl font-semibold text-[var(--color-text)]">Funtasktic MVP</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-text)]">
          Sign in to manage recurring chores across your shared lists.
        </p>

        <form className="mt-6 grid gap-3" onSubmit={handleSignIn}>
          <input
            type="text"
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name (for sign up)"
            maxLength={100}
          />
          <input
            type="email"
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="password"
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-cta)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authBusy}
            >
              Sign in
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSignUp}
              disabled={authBusy}
            >
              Create account
            </button>
          </div>
        </form>

        {invitePreview ? (
          <section className="mt-6 rounded-2xl bg-[var(--color-surface-muted)] p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Invitation</h2>
            <p className="mt-1 text-sm text-[var(--color-muted-text)]">
              {invitePreview.listName ?? 'A list'} from {invitePreview.invitedByDisplayName ?? 'a teammate'}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-[var(--color-muted-text)]">
              Status: {invitePreview.status}
            </p>
          </section>
        ) : null}

        {message ? <p className="mt-4 text-sm text-[var(--color-muted-text)]">{message}</p> : null}
      </section>
    </main>
  );
}
