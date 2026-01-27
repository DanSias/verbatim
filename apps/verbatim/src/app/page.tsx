/**
 * Verbatim Landing Page
 *
 * Sales-style landing page explaining Verbatim and how it works.
 * Uses Pilot visual language with dark mode support.
 */

import {
  LandingNav,
  Hero,
  HowItWorks,
  WhatYouGet,
  WidgetCallout,
  Security,
  Footer,
} from '@/components/landing';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <LandingNav />
      <main>
        <Hero />
        <HowItWorks />
        <WhatYouGet />
        <WidgetCallout />
        <Security />
      </main>
      <Footer />
    </div>
  );
}
