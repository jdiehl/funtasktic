import { FormEvent, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { firestore } from '@/lib/firebase/client';
import { authedRequest } from '@/lib/api/client';
import { ListOption } from '@/components/ListSelector';

interface CreateListResponse {
  listId: string;
}

interface UseMvpListManagementReturn {
  lists: ListOption[];
  activeListId: string | null;
  setActiveListId: (id: string | null) => void;
  newListName: string;
  setNewListName: (name: string) => void;
  busy: boolean;
  message: string | null;
  setMessage: (msg: string | null) => void;
  handleCreateList: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * Custom hook managing list selection and creation
 */
export function useMvpListManagement(user: User | null): UseMvpListManagementReturn {
  const [listIds, setListIds] = useState<string[]>([]);
  const [listMap, setListMap] = useState<Record<string, ListOption>>({});
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const lists = useMemo(
    () =>
      listIds
        .map((id) => listMap[id])
        .filter((list): list is ListOption => Boolean(list))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [listIds, listMap]
  );

  // Subscribe to user's list references
  useEffect(() => {
    if (!user) {
      setListIds([]);
      setListMap({});
      return;
    }

    const listRefsCollection = collection(firestore, 'users', user.uid, 'listRefs');

    return onSnapshot(listRefsCollection, (snapshot) => {
      const nextListIds = snapshot.docs
        .map((listRefDoc) => listRefDoc.id)
        .filter((listId): listId is string => Boolean(listId));

      setListIds([...new Set(nextListIds)]);
    });
  }, [user]);

  // Subscribe to list metadata
  useEffect(() => {
    if (!listIds.length) {
      setListMap({});
      return;
    }

    const unsubscribers = listIds.map((listId) =>
      onSnapshot(doc(firestore, 'lists', listId), (snapshot) => {
        if (!snapshot.exists()) {
          setListMap((prev) => {
            const next = { ...prev };
            delete next[listId];
            return next;
          });
          return;
        }

        const listData = snapshot.data() as { name?: string; timezone?: string; isArchived?: boolean };
        if (listData.isArchived) {
          return;
        }

        setListMap((prev) => ({
          ...prev,
          [listId]: {
            id: listId,
            name: listData.name ?? 'Untitled list',
            timezone: listData.timezone ?? 'UTC',
          },
        }));
      })
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [listIds]);

  // Update active list when lists change
  useEffect(() => {
    if (!lists.length) {
      setActiveListId(null);
      return;
    }

    if (!activeListId || !lists.some((list) => list.id === activeListId)) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);

  async function handleCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const response = await authedRequest<CreateListResponse>(user, '/api/lists', {
        method: 'POST',
        body: JSON.stringify({ name: newListName.trim(), timezone }),
      });
      setNewListName('');
      setActiveListId(response.listId);
      setMessage('List created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create list');
    } finally {
      setBusy(false);
    }
  }

  return {
    lists,
    activeListId,
    setActiveListId,
    newListName,
    setNewListName,
    busy,
    message,
    setMessage,
    handleCreateList,
  };
}
