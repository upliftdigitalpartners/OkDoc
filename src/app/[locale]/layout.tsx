import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { Link } from '@/i18n/navigation';
import { routing, rtlLocales } from '@/i18n/routing';
import '../globals.css';

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#086275' },
    { media: '(prefers-color-scheme: dark)', color: '#10181e' },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    title: t('appName'),
    description: t('tagline'),
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icon-192.png', sizes: '192x192' },
      ],
      apple: '/apple-touch-icon.png',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'common' });
  const tFooter = await getTranslations({ locale, namespace: 'footer' });

  return (
    <html lang={locale} dir={rtlLocales.has(locale) ? 'rtl' : 'ltr'}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <ServiceWorkerRegister />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:text-lg focus:font-semibold"
          >
            {t('skipToContent')}
          </a>
          <header className="no-print border-b border-line">
            <div className="mx-auto flex min-h-16 w-full max-w-xl flex-wrap items-center justify-between gap-x-4 px-4 py-1">
              <Link href="/" className="text-2xl font-extrabold text-brand">
                {t('appName')}
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center gap-2 text-lg font-semibold text-brand underline underline-offset-4"
              >
                <span aria-hidden="true">🌐</span>
                {t('changeLanguage')}
              </Link>
            </div>
          </header>
          <main id="main" className="flex-1 pt-4">
            {children}
          </main>
          <footer className="mt-8 border-t border-line">
            <div className="mx-auto w-full max-w-xl px-4 py-6">
              <p className="text-base text-ink-muted">{tFooter('disclaimer')}</p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
