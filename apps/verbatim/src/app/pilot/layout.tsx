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
import {
  Home,
  Layers,
  UploadCloud,
  FileText,
  Search,
  MessageSquareText,
  Bot,
  Plug,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';

/** Navigation item definition */
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If true, only match exact pathname (not prefix) */
  exactMatch?: boolean;
}

/** Navigation section with heading and items */
interface NavSection {
  heading: string;
  items: NavItem[];
}

/** Navigation sections configuration */
const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Overview',
    items: [
      { href: '/pilot', label: 'Pilot Home', icon: Home, exactMatch: true },
    ],
  },
  {
    heading: 'Core',
    items: [
      { href: '/pilot/workspaces', label: 'Workspaces', icon: Layers },
      { href: '/pilot/ingest', label: 'Ingest', icon: UploadCloud },
      { href: '/pilot/sources', label: 'Sources', icon: FileText },
    ],
  },
  {
    heading: 'Q&A',
    items: [
      { href: '/pilot/ask', label: 'Ask', icon: Search },
      { href: '/pilot/answer', label: 'Answer', icon: MessageSquareText },
    ],
  },
  {
    heading: 'Widget',
    items: [
      { href: '/pilot/widget', label: 'Widget Demo', icon: Bot, exactMatch: true },
      { href: '/pilot/widget/install', label: 'Widget Install', icon: Plug },
    ],
  },
  {
    heading: 'Analytics',
    items: [
      { href: '/pilot/usage', label: 'Usage', icon: BarChart3 },
    ],
  },
];

/**
 * Check if a nav item is active based on current pathname.
 * - exactMatch: only match if pathname === href
 * - Otherwise: match if pathname === href OR pathname starts with href + "/"
 */
function isNavItemActive(pathname: string, item: NavItem): boolean {
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
        <div className="flex items-center">
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-lg">Verbatim</span>
          <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            Pilot
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800">
        <WorkspaceSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="mb-6">
            {/* Section heading */}
            <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {section.heading}
            </h3>

            {/* Section items */}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                        transition-colors duration-150
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                        dark:focus-visible:ring-offset-gray-900
                        ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-l-2 border-blue-600 dark:border-blue-500 -ml-[2px] pl-[14px]'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
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
    </aside>
  );
}

export default function PilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="ml-[260px] min-h-screen">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
