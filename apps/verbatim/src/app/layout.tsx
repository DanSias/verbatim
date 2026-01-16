import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verbatim',
  description: 'Documentation assistant with citations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
