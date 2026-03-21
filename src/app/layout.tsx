import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AmbientBackdrop } from '@/components/ambient-backdrop';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Job Hunter',
  description: 'AI-powered job hunting assistant',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <AmbientBackdrop />
        {children}
      </body>
    </html>
  );
}
