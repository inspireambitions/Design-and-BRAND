import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Sans_Arabic, Public_Sans } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageProvider';

const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  // Avoid a late headline font swap becoming the page's LCP on slow phones.
  display: 'optional',
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
  // Four Arabic weights should load when Arabic is used, not be preloaded on
  // every English page.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://trymuqabala.com'),
  title: {
    default: 'Muqabala | Interview practice for Gulf jobs',
    template: '%s | Muqabala',
  },
  description:
    'Practise Gulf job interviews in English or Arabic. See what worked, what is missing and what to add next.',
  applicationName: 'Muqabala',
  category: 'career',
  openGraph: {
    type: 'website',
    siteName: 'Muqabala',
    title: 'Muqabala | Interview practice for Gulf jobs',
    description: 'Private Gulf interview practice with clear feedback in English or Arabic.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Muqabala | Interview practice for Gulf jobs',
    description: 'Private Gulf interview practice with clear feedback in English or Arabic.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B7A6B',
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
      </body>
    </html>
  );
}
