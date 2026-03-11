import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Delta Intelligence System',
  description: 'Corporate controller platform for Delta360 Energy',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
