'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, firestore } from '@/lib/firebase/client';
import { authedRequest, request } from '@/lib/api/client';
import { useAuth } from '@/hooks/useAuth';
import { InvitationInput } from '@/components/InvitationInput';
import { LeaderboardUser, LeaderboardView } from '@/components/LeaderboardView';
import { ListOption, ListSelector } from '@/components/ListSelector';
import { TaskCard } from '@/components/TaskCard';
import { TaskForm } from '@/components/TaskForm';
import { UserAvatar } from '@/components/UserAvatar';

interface CreateListResponse {
  listId: string;
}

interface InviteResponse {
  token: string;
}

interface CompletionResponse {
  completionId: string;
}

interface InvitationPreview {
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  listName?: string;
  invitedByDisplayName?: string;
}

interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  pointsPerCompletion: number;
  nextDueAt?: unknown;
  isActive: boolean;
}

interface CompletionItem {
  id: string;
  taskTitle: string;
  completedAt?: unknown;
  pointsAwarded: number;
  completedByUserId: string;
}

interface MemberInfo {
  displayName: string;
  avatarUrl?: string | null;
}

interface LeaderboardEntry {
  userId: string;
  pointsTotal: number;
}

function asDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    const converted = maybeTimestamp.toDate?.();
    if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
      return converted;
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function periodKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear().toString().slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export function MvpApp() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [listIds, setListIds] = useState<string[]>([]);
  const [listMap, setListMap] = useState<Record<string, ListOption>>({});
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const [newListName, setNewListName] = useState('');

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [members, setMembers] = useState<Record<string, MemberInfo>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [invitePreview, setInvitePreview] = useState<InvitationPreview | null>(null);
  const inviteToken = searchParams?.get('invite') ?? null;

  const lists = useMemo(
    () =>
      listIds
        .map((id) => listMap[id])
        .filter((list): list is ListOption => Boolean(list))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [listIds, listMap]
  );

  useEffect(() => {
    if (!lists.length) {
      setActiveListId(null);
      return;
    }

    if (!activeListId || !lists.some((list) => list.id === activeListId)) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);

  useEffect(() => {
    if (!inviteToken) {
      setInvitePreview(null);
      return;
    }

    request<InvitationPreview>(`/api/invitations/${inviteToken}`)
      .then((preview) => setInvitePreview(preview))
      .catch((error: unknown) => {
        setInvitePreview({
          status: 'expired',
          listName: 'Unknown list',
          invitedByDisplayName: error instanceof Error ? error.message : 'Invitation unavailable',
        });
      });
  }, [inviteToken]);

  useEffect(() => {
    if (!user) {
      setListIds([]);
      setListMap({});
      setTasks([]);
      setCompletions([]);
      setMembers({});
      setLeaderboard([]);
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

  useEffect(() => {
    if (!activeListId) {
      setTasks([]);
      setCompletions([]);
      setMembers({});
      setLeaderboard([]);
      return;
    }

    const tasksRef = collection(firestore, 'lists', activeListId, 'tasks');
    const completionsRef = query(
      collection(firestore, 'lists', activeListId, 'taskCompletions'),
      orderBy('completedAt', 'desc'),
      limit(8)
    );
    const membersRef = collection(firestore, 'lists', activeListId, 'members');
    const leaderboardRef = doc(
      firestore,
      'lists',
      activeListId,
      'leaderboards',
      periodKeyFromDate(new Date())
    );

    const unsubTasks = onSnapshot(tasksRef, (snapshot) => {
      const parsed = snapshot.docs
        .map((taskDoc) => {
          const task = taskDoc.data() as TaskItem & { isArchived?: boolean };
          if ((task as { isArchived?: boolean }).isArchived) {
            return null;
          }
          return {
            ...task,
            id: taskDoc.id,
          };
        })
        .filter((task): task is TaskItem => Boolean(task))
        .sort((a, b) => {
          const aDate = asDate(a.nextDueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bDate = asDate(b.nextDueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aDate - bDate;
        });

      setTasks(parsed);
    });

    const unsubCompletions = onSnapshot(completionsRef, (snapshot) => {
      const parsed = snapshot.docs.map((completionDoc) => ({
        ...(completionDoc.data() as CompletionItem),
        id: completionDoc.id,
      }));
      setCompletions(parsed);
    });

    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      const nextMembers: Record<string, MemberInfo> = {};
      for (const memberDoc of snapshot.docs) {
        const data = memberDoc.data() as MemberInfo;
        nextMembers[memberDoc.id] = {
          displayName: data.displayName ?? 'User',
          avatarUrl: data.avatarUrl ?? null,
        };
      }
      setMembers(nextMembers);
    });

    const unsubLeaderboard = onSnapshot(leaderboardRef, (snapshot) => {
      if (!snapshot.exists()) {
        setLeaderboard([]);
        return;
      }

      const data = snapshot.data() as { users?: LeaderboardEntry[] };
      setLeaderboard(data.users ?? []);
    });

    return () => {
      unsubTasks();
      unsubCompletions();
      unsubMembers();
      unsubLeaderboard();
    };
  }, [activeListId]);

  useEffect(() => {
    if (!user) {
      return;
    }

    return onIdTokenChanged(auth, async (updatedUser) => {
      if (!updatedUser) {
        return;
      }

      try {
        const idToken = await updatedUser.getIdToken();
        await request<{ success: boolean }>('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch {
        // Session refresh failure should not block the local app state.
      }
    });
  }, [user]);

  const leaderboardUsers: LeaderboardUser[] = useMemo(
    () =>
      leaderboard.map((entry) => ({
        ...entry,
        displayName: members[entry.userId]?.displayName ?? entry.userId,
        avatarUrl: members[entry.userId]?.avatarUrl ?? null,
      })),
    [leaderboard, members]
  );

  async function finalizeAuth(nextDisplayName?: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    const idToken = await currentUser.getIdToken(true);

    await request<{ success: boolean }>('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    await authedRequest<{ success: boolean }>(currentUser, '/api/users/bootstrap', {
      method: 'POST',
    });

    if (nextDisplayName && nextDisplayName.trim().length > 0) {
      const normalized = nextDisplayName.trim();
      await updateProfile(currentUser, { displayName: normalized });
      await authedRequest<{ success: boolean }>(currentUser, `/api/users/${currentUser.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: normalized }),
      });
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setMessage(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      await finalizeAuth();
      setMessage('Signed in. Ready to tackle chores.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignUp() {
    setAuthBusy(true);
    setMessage(null);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await finalizeAuth(displayName);
      setMessage('Account created. Personal list is ready.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create account');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setMessage(null);

    try {
      await request<{ success: boolean }>('/api/auth/session', { method: 'DELETE' });
      await signOut(auth);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out');
    } finally {
      setBusy(false);
    }
  }

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

  async function handleCreateTask(values: {
    title: string;
    description: string;
    pointsPerCompletion: number;
    recurrenceMode: 'interval_after_completion' | 'fixed_schedule';
    intervalValue: number;
    intervalUnit: 'days' | 'weeks' | 'months';
  }) {
    if (!user || !activeListId) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const recurrenceConfig =
        values.recurrenceMode === 'interval_after_completion'
          ? {
              type: 'interval_after_completion',
              intervalValue: values.intervalValue,
              intervalUnit: values.intervalUnit,
            }
          : {
              type: 'fixed_schedule',
              dayOfWeek: [1],
            };

      await authedRequest<{ success: boolean }>(user, `/api/lists/${activeListId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: values.title.trim(),
          description: values.description.trim() || null,
          pointsPerCompletion: values.pointsPerCompletion,
          recurrenceMode: values.recurrenceMode,
          recurrenceConfig,
          isActive: true,
        }),
      });

      setMessage('Task created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create task');
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
    if (!user || !activeListId) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest<CompletionResponse>(user, `/api/lists/${activeListId}/completions`, {
        method: 'POST',
        body: JSON.stringify({ taskId }),
      });
      setMessage('Completion recorded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete task');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveTask(taskId: string) {
    if (!user || !activeListId) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest<{ success: boolean }>(user, `/api/lists/${activeListId}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      setMessage('Task archived.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not archive task');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevertCompletion(completionId: string) {
    if (!user || !activeListId) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest<{ success: boolean }>(
        user,
        `/api/lists/${activeListId}/completions/${completionId}`,
        { method: 'DELETE' }
      );
      setMessage('Completion reverted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not revert completion');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateInvite() {
    if (!user || !activeListId) {
      throw new Error('Pick a list first');
    }

    const response = await authedRequest<InviteResponse>(user, `/api/lists/${activeListId}/invitations`, {
      method: 'POST',
    });

    return `${window.location.origin}/?invite=${response.token}`;
  }

  async function handleAcceptInvite() {
    if (!user || !inviteToken) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest<{ success: boolean; listId: string }>(user, `/api/invitations/${inviteToken}/accept`, {
        method: 'POST',
      });
      const nextUrl = window.location.pathname;
      router.replace(nextUrl);
      setMessage('Invite accepted. List added to your workspace.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not accept invite');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4">Loading...</main>;
  }

  if (!user) {
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
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
              onClick={handleAcceptInvite}
              disabled={busy}
            >
              Accept invite
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSignOut}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
      </header>

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

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <section className="grid gap-4">
          <TaskForm onSubmit={handleCreateTask} disabled={busy || !activeListId} />

          <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Open tasks</h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-text)]">No active chores in this list yet.</p>
            ) : (
              <div className="grid gap-3">
                {tasks.map((task) => {
                  const dueDate = asDate(task.nextDueAt);
                  const dueLabel = dueDate
                    ? dueDate.toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Not set';

                  return (
                    <TaskCard
                      key={task.id}
                      taskId={task.id}
                      title={task.title}
                      description={task.description}
                      pointsPerCompletion={task.pointsPerCompletion}
                      nextDueLabel={dueLabel}
                      isActive={task.isActive}
                      onComplete={handleCompleteTask}
                      onArchive={handleArchiveTask}
                      busy={busy}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Recent completions</h2>
            {completions.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-text)]">No completions yet.</p>
            ) : (
              <ul className="space-y-2">
                {completions.map((completion) => {
                  const completedAtDate = asDate(completion.completedAt);
                  return (
                    <li
                      key={completion.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-surface-muted)] px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">{completion.taskTitle}</p>
                        <p className="text-xs text-[var(--color-muted-text)]">
                          {completedAtDate ? completedAtDate.toLocaleString() : 'Unknown time'} • +
                          {completion.pointsAwarded} pts
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-muted-text)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleRevertCompletion(completion.id)}
                        disabled={busy || completion.completedByUserId !== user.uid}
                      >
                        Revert
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>

        <aside className="grid h-fit gap-4">
          <LeaderboardView users={leaderboardUsers} />
          <InvitationInput onGenerate={handleGenerateInvite} disabled={busy || !activeListId} />
        </aside>
      </div>

      {message ? <p className="mt-4 text-sm text-[var(--color-muted-text)]">{message}</p> : null}
    </main>
  );
}
