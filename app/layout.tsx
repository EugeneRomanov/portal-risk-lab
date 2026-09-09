import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://portal-risk-lab.romanov6229.chatgpt.site'),
  title: 'Лаборатория нестабильных порталов',
  description: 'Оперативный контроль магических порталов, рисков и действий лаборатории.',
  openGraph: {
    title: 'Лаборатория нестабильных порталов',
    description: 'Контроль риска. Решения до схлопывания.',
    images: [{ url: '/og.png', width: 1732, height: 908, alt: 'Лаборатория нестабильных порталов' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Лаборатория нестабильных порталов',
    description: 'Контроль риска. Решения до схлопывания.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
