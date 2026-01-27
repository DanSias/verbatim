/**
 * Landing Page Widget Callout Section
 */

import Link from 'next/link';
import { landingCopy } from '@/lib/landing/copy';
import { ExternalLink } from 'lucide-react';

export function WidgetCallout() {
  const { title, description, ctaText, ctaHref } = landingCopy.widgetCallout;

  return (
    <section className="py-20 px-6 bg-blue-50 dark:bg-blue-900/10">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {title}
        </h2>
        <p className="text-base text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-blue-900/10 transition-colors"
        >
          {ctaText}
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
