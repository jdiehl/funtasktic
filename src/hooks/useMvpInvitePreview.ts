import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { request } from '@/lib/api/client';
import { InvitationPreview } from '@/components/mvp/types';

interface UseMvpInvitePreviewReturn {
  inviteToken: string | null;
  invitePreview: InvitationPreview | null;
}

/**
 * Custom hook managing invite preview loading from URL parameter
 */
export function useMvpInvitePreview(): UseMvpInvitePreviewReturn {
  const searchParams = useSearchParams();
  const [invitePreview, setInvitePreview] = useState<InvitationPreview | null>(null);

  const inviteToken = searchParams?.get('invite') ?? null;

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

  return { inviteToken, invitePreview };
}
