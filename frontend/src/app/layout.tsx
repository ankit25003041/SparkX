import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'GeoSR — AI-Powered Satellite Super Resolution Mapping (SIH 2026)',
  description: 'Deep Learning Based Super Resolution Mapping (SRM) from Medium Resolution Satellite Imageries (Sentinel-2 10m → <4m GSD). SIH 2026 Problem Statement 26142.',
  keywords: [
    'Super Resolution',
    'Sentinel-2',
    'Remote Sensing',
    'GIS',
    'Deep Learning',
    'Smart India Hackathon 2026',
    'SIH 26142',
    'GeoSR',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
