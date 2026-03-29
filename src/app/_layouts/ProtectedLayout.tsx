'use client';

import { useState, ReactNode } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

interface ProtectedLayoutProps {
  children: ReactNode;
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
