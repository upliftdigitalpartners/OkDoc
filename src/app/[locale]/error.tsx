'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { primaryCta, secondaryAction } from '@/components/buttons';
import { Link } from '@/i18n/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  useEffect(() => {
    // Surfaces in the server logs / Vercel observability; no PII.
    console.error('Wizard error boundary:', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 text-center">
      <p className="text-6xl" aria-hidden="true">
        ⚠️
      </p>
      <h1 className="mt-4 text-3xl font-bold">{t('errorTitle')}</h1>
      <p className="mt-3 text-xl text-ink-muted">{t('errorBody')}</p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <button type="button" onClick={reset} className={primaryCta}>
          {t('retry')}
        </button>
        <Link href="/" className={secondaryAction}>
          {t('goHome')}
        </Link>
      </div>
    </div>
  );
}
