'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { zipToCounty } from '@/lib/geo';
import { primaryCta, textField } from './buttons';

export function ZipForm({ baseQuery }: { baseQuery: Record<string, string> }) {
  const t = useTranslations('location');
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = zip.trim();
    if (!/^\d{5}$/.test(trimmed)) {
      setError(t('zipError'));
      return;
    }
    if (!zipToCounty(trimmed)) {
      setError(t('zipOutside'));
      return;
    }
    const rest = { ...baseQuery };
    delete rest.county;
    router.push({ pathname: '/plan', query: { ...rest, zip: trimmed } });
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={inputId} className="block text-xl font-semibold">
        {t('zipLabel')}
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          name="zip"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder={t('zipPlaceholder')}
          value={zip}
          onChange={(e) => {
            setZip(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${textField} sm:max-w-48`}
        />
        <button type="submit" className={`${primaryCta} sm:w-auto`}>
          {t('zipSubmit')}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-lg font-semibold text-warn">
          {error}
        </p>
      ) : null}
    </form>
  );
}
