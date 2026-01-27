/**
 * Landing Page Hero Section
 */

import Link from 'next/link';
import { landingCopy } from '@/lib/landing/copy';

export function Hero() {
  const { headline, subhead, ctaPrimary, ctaSecondary } = landingCopy.hero;

  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">{headline}</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
          {subhead}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/pilot"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 transition-colors"
          >
            {ctaPrimary}
          </Link>
          <Link
            href="/pilot/sources"
            className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-base font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 transition-colors"
          >
            {ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}
