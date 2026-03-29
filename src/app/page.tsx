import Link from 'next/link';
import { Button, Heading, Paragraph } from '@/components/ui';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--color-text)] mb-4">
            Funtasktic
          </h1>
          <p className="text-lg sm:text-xl text-[var(--color-muted-text)] mb-2">
            Recurring chores, fair points, shared momentum.
          </p>
          <p className="text-base text-[var(--color-muted-text)]">
            Manage recurring tasks fairly across friends and family groups.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 sm:mb-20">
          <div className="rounded-2xl bg-white p-6 shadow-md">
            <div className="mb-3 text-3xl">✓</div>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              Recurring Chores
            </h3>
            <p className="text-sm text-[var(--color-muted-text)]">
              Set up recurring tasks that repeat on a schedule. Flexible recurrence patterns for every need.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-md">
            <div className="mb-3 text-3xl">🏆</div>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              Fair Scoring
            </h3>
            <p className="text-sm text-[var(--color-muted-text)]">
              Earn points for completing chores and compete on fair leaderboards with your group.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-md">
            <div className="mb-3 text-3xl">👥</div>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              Group Collaboration
            </h3>
            <p className="text-sm text-[var(--color-muted-text)]">
              Create shared lists and invite friends or family. See who's contributing and celebrate wins.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/signin">
            <Button variant="primary" size="lg" className="px-8">
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

