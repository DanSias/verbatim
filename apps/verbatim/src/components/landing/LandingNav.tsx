'use client';

/**
 * Landing Page Navigation
 *
 * Top nav bar with logo, CTAs, and theme toggle.
 */

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme';

export function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 rounded"
        >
          <span className="text-xl font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            Verbatim
          </span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            Pilot
          </span>
        </Link>

        {/* Right: CTAs + Theme toggle */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/pilot"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 transition-colors"
          >
            Open Pilot
          </Link>
        </div>
      </div>
    </nav>
  );
}
