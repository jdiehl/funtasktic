import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { authedRequest } from '@/lib/api/client';

interface UseAcceptInviteReturn {
  handleAcceptInvite: (inviteToken: string) => Promise<void>;
}

/**
 * Custom hook for accepting invitations
 */
export function useAcceptInvite(user: User | null): UseAcceptInviteReturn {
  const router = useRouter();

  async function handleAcceptInvite(inviteToken: string) {
    if (!user || !inviteToken) {
      return;
    }

    try {
      await authedRequest<{ success: boolean; listId: string }>(
        user,
        `/api/invitations/${inviteToken}/accept`,
        { method: 'POST' }
      );
      const nextUrl = window.location.pathname;
      router.replace(nextUrl);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Could not accept invite');
    }
  }

  return { handleAcceptInvite };
}
