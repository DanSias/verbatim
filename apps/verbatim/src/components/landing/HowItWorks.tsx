/**
 * Landing Page "How It Works" Section
 */

import { landingCopy } from '@/lib/landing/copy';
import { UploadCloud, Search, MessageSquareText } from 'lucide-react';

const stepIcons = {
  1: UploadCloud,
  2: Search,
  3: MessageSquareText,
};

export function HowItWorks() {
  const { title, steps } = landingCopy.howItWorks;

  return (
    <section className="py-20 px-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 text-center mb-12">
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => {
            const Icon = stepIcons[step.number as keyof typeof stepIcons];
            return (
              <div
                key={step.number}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg font-bold text-lg">
                    {step.number}
                  </div>
                  <Icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
