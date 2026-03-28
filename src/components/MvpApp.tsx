'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { AuthSection } from '@/components/mvp/AuthSection';
import { MainHeader } from '@/components/mvp/MainHeader';
import { ListControlsSection } from '@/components/mvp/ListControlsSection';
import { TasksSection } from '@/components/mvp/TasksSection';
import { CompletionsSection } from '@/components/mvp/CompletionsSection';
import { SidebarSection } from '@/components/mvp/SidebarSection';

export function MvpApp() {
  const { user, loading } = useMvpAuth();

  if (loading) {
    return <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4">Loading...</main>;
  }

  if (!user) {
    return <AuthSection />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <MainHeader />

      <ListControlsSection />

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <section className="grid gap-4">
          <TasksSection />
          <CompletionsSection />
        </section>

        <SidebarSection />
      </div>
    </main>
  );
}
