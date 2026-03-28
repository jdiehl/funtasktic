'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { useMvpActiveListData } from '@/hooks/useMvpActiveListData';
import { InvitationInput } from '@/components/InvitationInput';
import { LeaderboardView } from '@/components/LeaderboardView';

export function SidebarSection() {
  const { user } = useMvpAuth();
  const { activeListId } = useMvpListManagement(user);
  const { leaderboardUsers, busy, handleGenerateInvite } = useMvpActiveListData(user, activeListId);
  return (
    <aside className="grid h-fit gap-4">
      <LeaderboardView users={leaderboardUsers} />
      <InvitationInput onGenerate={handleGenerateInvite} disabled={busy || !activeListId} />
    </aside>
  );
}
