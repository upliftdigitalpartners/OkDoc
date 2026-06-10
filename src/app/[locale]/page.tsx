import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ProgressDots } from '@/components/ProgressDots';
import { bigChoice } from '@/components/buttons';
import { Link } from '@/i18n/navigation';
import { localeNames, routing, rtlLocales } from '@/i18n/routing';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'home' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-12">
      <ProgressDots step={1} />
      <h1 className="mt-2 text-4xl font-extrabold text-brand">{t('title')}</h1>
      <p className="mt-2 text-2xl font-semibold">{tCommon('tagline')}</p>
      <p className="mt-3 text-xl text-ink-muted">{t('intro')}</p>

      <h2 className="mt-8 text-xl font-semibold">{t('chooseLanguage')}</h2>
      <ul
        aria-label={t('languageListLabel')}
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {routing.locales.map((code) => (
          <li key={code}>
            <Link
              href="/location"
              locale={code}
              lang={code}
              dir={rtlLocales.has(code) ? 'rtl' : 'ltr'}
              aria-current={code === locale ? 'true' : undefined}
              className={`${bigChoice} ${
                code === locale ? 'border-brand bg-brand-soft' : ''
              }`}
            >
              {localeNames[code]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
