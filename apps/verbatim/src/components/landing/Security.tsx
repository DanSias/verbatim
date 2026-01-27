/**
 * Landing Page Security Section
 */

import { landingCopy } from '@/lib/landing/copy';
import { Shield } from 'lucide-react';

export function Security() {
  const { title, description } = landingCopy.security;

  return (
    <section className="py-16 px-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-8">
        <div className="flex items-start gap-4">
          <Shield className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
