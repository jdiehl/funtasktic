import { FormEvent, useState } from 'react';

interface InvitationInputProps {
  onGenerate: () => Promise<string>;
  disabled?: boolean;
}

export function InvitationInput({ onGenerate, disabled }: InvitationInputProps) {
  const [inviteUrl, setInviteUrl] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    const url = await onGenerate();
    setInviteUrl(url);
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Share this list</h2>
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <button
          type="submit"
          className="w-fit rounded-xl bg-[var(--color-accent-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
        >
          Generate invite link
        </button>
        {inviteUrl ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted-text)]">
            Invite link
            <input
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)]"
              readOnly
              value={inviteUrl}
              onFocus={(event) => event.target.select()}
            />
          </label>
        ) : null}
      </form>
    </section>
  );
}
