import { useTranslations } from 'next-intl';

export function DemoBanner() {
  const t = useTranslations('common');
  return (
    <p
      role="status"
      className="mb-6 rounded-xl border-2 border-warn bg-warn-soft px-4 py-3 text-lg font-semibold text-warn"
    >
      <span aria-hidden="true">ⓘ</span> {t('demoBanner')}
    </p>
  );
}
