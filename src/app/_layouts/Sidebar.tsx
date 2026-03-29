'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { Button, Heading } from '@/components/ui';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useMvpAuth();
  const { lists } = useMvpListManagement(user);
  const pathname = usePathname();

  if (!user) return null;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 sm:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} sm:relative sm:translate-x-0 sm:w-80 lg:w-96`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Heading level={3}>Lists</Heading>
            <button
              onClick={onClose}
              className="sm:hidden p-1 hover:bg-[var(--color-surface-muted)] rounded transition"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Lists */}
          <div className="space-y-2">
            {lists.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-text)] py-4">No lists yet</p>
            ) : (
              lists.map((list) => {
                const isActive = pathname === `/lists/${list.id}`;
                return (
                  <Link
                    key={list.id}
                    href={`/lists/${list.id}`}
                    onClick={onClose}
                    className={`block px-4 py-2 rounded-lg transition ${
                      isActive
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)] font-semibold'
                        : 'text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'
                    }`}
                  >
                    {list.name}
                  </Link>
                );
              })
            )}
          </div>

          {/* Create new list button */}
          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <Link href="/lists/new" onClick={onClose}>
              <Button variant="primary" size="md" className="w-full">
                New list
              </Button>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
