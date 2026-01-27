/**
 * Landing Page "What You Get" Feature Grid
 */

import { landingCopy } from '@/lib/landing/copy';
import { Layers, FileText, Search, Link, Bot, BarChart3 } from 'lucide-react';

const featureIcons = {
  Layers,
  FileText,
  Search,
  Link,
  Bot,
  BarChart3,
};

export function WhatYouGet() {
  const { title, features } = landingCopy.whatYouGet;

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 text-center mb-12">
          {title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = featureIcons[feature.icon as keyof typeof featureIcons];
            return (
              <div
                key={feature.title}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-3" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
