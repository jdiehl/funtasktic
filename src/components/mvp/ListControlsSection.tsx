'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { Section, Input, Button } from '@/components/ui';
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
    <Section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ListSelector lists={lists} value={activeListId} onChange={setActiveListId} disabled={busy} />
        <form className="flex w-full gap-2 sm:max-w-md" onSubmit={handleCreateList}>
          <Input
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            placeholder="New list name"
            required
            maxLength={120}
            className="w-full"
          />
          <Button type="submit" variant="primary" size="md" disabled={busy}>
            Create
          </Button>
        </form>
      </div>
    </Section>
  );
}
