'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpInvitePreview } from '@/hooks/useMvpInvitePreview';
import { Button, Input, Heading, Paragraph, Alert } from '@/components/ui';

export default function SignInPage() {
  const router = useRouter();
  const {
    user,
    loading,
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

  useEffect(() => {
    if (!loading && user) {
      router.replace('/home');
    }
  }, [loading, router, user]);

  if (loading || user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-white/95 p-6 shadow-[0_14px_42px_rgba(13,32,44,0.12)] sm:p-8">
        <div className="mb-6">
          <Heading level={2}>Sign in</Heading>
          <Paragraph muted small className="mt-2">
            Access your chores and leaderboards.
          </Paragraph>
        </div>

        <form className="grid gap-3" onSubmit={handleSignIn}>
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
          <div className="flex flex-wrap gap-2 pt-2">
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
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Invitation</h3>
            <p className="mt-1 text-sm">
              {invitePreview.listName ?? 'A list'} from {invitePreview.invitedByDisplayName ?? 'a teammate'}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide">
              Status: {invitePreview.status}
            </p>
          </Alert>
        ) : null}

        {message ? <Paragraph muted small className="mt-4">{message}</Paragraph> : null}

        <div className="mt-6 pt-6 border-t border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-muted-text)]">
            New to Funtasktic?{' '}
            <Link href="/" className="text-[var(--color-cta)] hover:underline font-semibold">
              Learn more
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
