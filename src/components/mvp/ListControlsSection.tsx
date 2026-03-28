'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { ListSelector } from '@/components/ListSelector';

export function ListControlsSection() {
  const { user } = useMvpAuth();
  const {
    lists,
    activeListId,
    setActiveListId,
    newListName,
    setNewListName,
    busy,
    handleCreateList,
  } = useMvpListManagement(user);
  return (
    <section className="mb-6 grid gap-4 rounded-3xl border border-[var(--color-border)] bg-white/90 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ListSelector lists={lists} value={activeListId} onChange={setActiveListId} disabled={busy} />
        <form className="flex w-full gap-2 sm:max-w-md" onSubmit={handleCreateList}>
          <input
            className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            placeholder="New list name"
            required
            maxLength={120}
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--color-cta)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
          >
            Create
          </button>
        </form>
      </div>
    </section>
  );
}
