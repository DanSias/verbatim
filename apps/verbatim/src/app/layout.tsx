import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Verbatim',
  description: 'Documentation assistant with citations',
};

/**
 * Inline script to prevent FOUC (Flash of Unstyled Content) for dark mode.
 * Runs before React hydrates to set the correct theme class on <html>.
 *
 * localStorage key: 'verbatim_theme' (values: 'light' | 'dark')
 */
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('verbatim_theme');
    var theme = stored;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
