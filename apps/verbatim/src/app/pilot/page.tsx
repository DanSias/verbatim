'use client';

/**
 * Pilot Landing Page
 *
 * Entry point for internal testing UI.
 * Shows links to ingest/ask pages. Workspace selection is handled by sidebar.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PILOT_NAV_SECTIONS, type PilotNavSection } from '@/lib/pilot/nav';

export default function PilotPage() {
  const cardSections: PilotNavSection[] = PILOT_NAV_SECTIONS.filter(
    (section) => section.label !== 'Overview'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pilot Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Configure workspaces, manage sources, and evaluate retrieval and answers.
        </p>
      </div>

      {/* Action cards */}
      <div className="space-y-6">
        {cardSections.map((section) => {
          const sectionId = section.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const itemCount = section.items.length;
          const gridClass =
            itemCount === 1
              ? 'grid-cols-1'
              : itemCount === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
          return (
            <section key={section.label} aria-labelledby={`pilot-${sectionId}-heading`}>
              <h2
                id={`pilot-${sectionId}-heading`}
                className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider"
              >
                {section.label}
              </h2>
              {section.sectionDescription && (
                <p className="mt-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                  {section.sectionDescription}
                </p>
              )}
              <div className={`grid ${gridClass} gap-4`}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group relative flex h-full flex-col gap-3 rounded-lg border border-gray-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-gray-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700 dark:hover:bg-gray-800/60 dark:focus-visible:ring-offset-gray-950"
                    >
                      <span className="absolute right-4 top-4 text-gray-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-within:translate-x-0.5 group-focus-within:opacity-100 dark:text-gray-600">
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {item.label}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
