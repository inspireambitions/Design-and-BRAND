import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Sans_Arabic, Public_Sans } from 'next/font/google';
import './globals.css';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { WebVitals } from '@/components/WebVitals';
import { LanguageProvider } from '@/components/LanguageProvider';

const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const bodyFont = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
});

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
  // Fetched only when Arabic text renders, so English pages keep it off the critical path.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://trymuqabala.com'),
  title: {
    default: 'Muqabala | Interview practice for Gulf jobs',
    template: '%s | Muqabala',
  },
  description:
    'Practise real Gulf interview questions out loud, in English or Arabic, and get honest feedback. Free, no account. We score your answer. Not your accent. Not your face.',
  applicationName: 'Muqabala',
  category: 'career',
  openGraph: {
    type: 'website',
    siteName: 'Muqabala',
    title: 'Muqabala | Interview practice for Gulf jobs',
    description: 'Practise real Gulf interview questions out loud, in English or Arabic, and get honest feedback. Free, no account. We score your answer. Not your accent. Not your face.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Muqabala | Interview practice for Gulf jobs',
    description: 'Practise real Gulf interview questions out loud, in English or Arabic, and get honest feedback. Free, no account. We score your answer. Not your accent. Not your face.',
  },
  verification: {
    google: 'CzEnPDgPrKfnxXMie9ojnjNUOIQbT2P-L-_2SopKSf4',
  },
};

export const viewport: Viewport = {
  themeColor: '#0E3B36',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Muqabala',
    url: 'https://trymuqabala.com',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any modern web browser',
    inLanguage: ['en', 'ar'],
    description: 'Interview practice for candidates applying to Gulf jobs.',
    provider: {
      '@type': 'Organization',
      name: 'Inspire Ambitions',
      url: 'https://inspireambitions.com',
    },
  };

  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${arabicFont.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
        />
        <LanguageProvider>{children}</LanguageProvider>
        <GoogleAnalytics />
        <WebVitals />
      </body>
    </html>
  );
}
