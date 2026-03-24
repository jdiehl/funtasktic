/**
 * Hook for subscribing to list data with real-time updates
 */

import { useEffect, useState } from 'react';
import { firestore } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { List } from '@/lib/types/firestore';

export function useList(listId: string) {
  const [data, setData] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!listId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(firestore, 'lists', listId),
      (snapshot) => {
        if (snapshot.exists()) {
          setData(snapshot.data() as List);
        }
        setLoading(false);
      },
      (error) => {
        setError(error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [listId]);

  return { data, loading, error };
}
