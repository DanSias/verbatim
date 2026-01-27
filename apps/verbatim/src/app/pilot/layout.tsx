'use client';

/**
 * Pilot UI Layout
 *
 * Application shell with sidebar navigation for all /pilot pages.
 * Internal testing interface for ingestion, retrieval, and analytics.
 * Supports light and dark themes.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { SessionProvider } from '@/components/auth/session-provider';
import { UserMenu } from '@/components/auth/user-menu';
import { PILOT_NAV_SECTIONS, type PilotNavItem } from '@/lib/pilot/nav';

/**
 * Check if a nav item is active based on current pathname.
 * - exactMatch: only match if pathname === href
 * - Otherwise: match if pathname === href OR pathname starts with href + "/"
 */
function isNavItemActive(pathname: string, item: PilotNavItem): boolean {
  if (item.exactMatch) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

/** Sidebar navigation component */
function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Logo/Brand + Theme Toggle */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
        <Link
          href="/pilot"
          className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 rounded"
          title="Navigate to Pilot home"
        >
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            Verbatim
          </span>
          <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-700 dark:group-hover:text-blue-400 px-1.5 py-0.5 rounded transition-colors">
            Pilot
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Workspace
        </h3>
        <WorkspaceSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {PILOT_NAV_SECTIONS.map((section, index) => (
          <div key={section.label} className={index > 0 ? 'mt-6' : ''}>
            {/* Section heading */}
            <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {section.label}
            </h3>

            {/* Section items */}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium rounded-lg
                        transition-colors duration-150
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-gray-900
                        ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-100'
                        }
                      `}
                    >
                      <Icon
                        className={`w-5 h-5 flex-shrink-0 ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User menu (sign out) */}
      <UserMenu />
    </aside>
  );
}

export default function PilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <main className="ml-[260px] min-h-screen">
          <div className="max-w-6xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
