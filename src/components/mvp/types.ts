import { LeaderboardUser } from '@/components/LeaderboardView';
import { ListOption } from '@/components/ListSelector';

export interface InvitationPreview {
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  listName?: string;
  invitedByDisplayName?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  pointsPerCompletion: number;
  nextDueAt?: unknown;
  isActive: boolean;
}

export interface CompletionItem {
  id: string;
  taskTitle: string;
  completedAt?: unknown;
  pointsAwarded: number;
  completedByUserId: string;
}

export interface MemberInfo {
  displayName: string;
  avatarUrl?: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  pointsTotal: number;
}

export interface MvpMainViewProps {
  user: {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  };
  invitePreview: InvitationPreview | null;
  busy: boolean;
  lists: ListOption[];
  activeListId: string | null;
  newListName: string;
  tasks: TaskItem[];
  completions: CompletionItem[];
  leaderboardUsers: LeaderboardUser[];
  message: string | null;
  setActiveListId: (listId: string) => void;
  setNewListName: (name: string) => void;
  onCreateList: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateTask: (values: {
    title: string;
    description: string;
    pointsPerCompletion: number;
    recurrenceMode: 'interval_after_completion' | 'fixed_schedule';
    intervalValue: number;
    intervalUnit: 'days' | 'weeks' | 'months';
  }) => Promise<void>;
  onCompleteTask: (taskId: string) => Promise<void>;
  onArchiveTask: (taskId: string) => Promise<void>;
  onRevertCompletion: (completionId: string) => Promise<void>;
  onGenerateInvite: () => Promise<string>;
  onAcceptInvite: () => Promise<void>;
  onSignOut: () => Promise<void>;
}
