'use client';

/**
 * Pilot UI Layout
 *
 * Shared layout for all /pilot pages with navigation header.
 * Internal testing interface for ingestion and retrieval.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/pilot', label: 'Pilot Home' },
  { href: '/pilot/workspaces', label: 'Workspaces' },
  { href: '/pilot/ingest', label: 'Ingest' },
  { href: '/pilot/sources', label: 'Sources' },
  { href: '/pilot/ask', label: 'Ask' },
];

export default function PilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex items-center h-14 gap-1">
            <span className="font-semibold text-gray-900 mr-4">Verbatim</span>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
