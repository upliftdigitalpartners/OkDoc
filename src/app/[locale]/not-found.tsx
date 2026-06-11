import { useTranslations } from 'next-intl';
import { primaryCta } from '@/components/buttons';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 text-center">
      <p className="text-6xl font-extrabold text-brand" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 text-3xl font-bold">{t('notFoundTitle')}</h1>
      <p className="mt-3 text-xl text-ink-muted">{t('notFoundBody')}</p>
      <Link href="/" className={`${primaryCta} mt-8`}>
        {t('goHome')}
      </Link>
    </div>
  );
}
