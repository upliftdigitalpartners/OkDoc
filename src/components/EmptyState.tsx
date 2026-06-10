import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { primaryCta } from './buttons';

export function EmptyState({ baseQuery }: { baseQuery: Record<string, string> }) {
  const t = useTranslations('results');
  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-6 text-center">
      <h2 className="text-2xl font-bold">{t('emptyTitle')}</h2>
      <p className="mt-3 text-xl text-ink-muted">{t('emptyBody')}</p>
      <Link
        href={{ pathname: '/filters', query: baseQuery }}
        className={`${primaryCta} mt-6`}
      >
        {t('emptyAction')}
      </Link>
    </div>
  );
}
