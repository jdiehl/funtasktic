'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpInvitePreview } from '@/hooks/useMvpInvitePreview';
import { Button, Input, Heading, Paragraph, Alert } from '@/components/ui';

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
        <Heading level={1}>Funtasktic MVP</Heading>
        <Paragraph muted className="mt-2">
          Sign in to manage recurring chores across your shared lists.
        </Paragraph>

        <form className="mt-6 grid gap-3" onSubmit={handleSignIn}>
          <Input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name (for sign up)"
            maxLength={100}
          />
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
          />
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" disabled={authBusy}>
              Sign in
            </Button>
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={handleSignUp}
              disabled={authBusy}
            >
              Create account
            </Button>
          </div>
        </form>

        {invitePreview ? (
          <Alert type="info" className="mt-6">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Invitation</h2>
            <p className="mt-1 text-sm">
              {invitePreview.listName ?? 'A list'} from {invitePreview.invitedByDisplayName ?? 'a teammate'}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide">
              Status: {invitePreview.status}
            </p>
          </Alert>
        ) : null}

        {message ? <Paragraph muted small className="mt-4">{message}</Paragraph> : null}
      </section>
    </main>
  );
}
