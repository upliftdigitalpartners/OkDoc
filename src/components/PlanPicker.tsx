'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { Plan } from '@/lib/types';
import { bigChoice, textField } from './buttons';

interface Props {
  plans: Plan[];
  baseQuery: Record<string, string>;
}

export function PlanPicker({ plans, baseQuery }: Props) {
  const t = useTranslations('plan');
  const router = useRouter();
  const filterId = useId();
  const [payer, setPayer] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const payers = [...new Set(plans.map((p) => p.payer))].sort();

  if (!payer) {
    return (
      <section aria-label={t('payerLabel')}>
        <h2 className="text-xl font-semibold">{t('payerLabel')}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {payers.map((name) => (
            <li key={name}>
              <button
                type="button"
                className={bigChoice}
                onClick={() => setPayer(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-lg text-ink-muted">{t('notSure')}</p>
      </section>
    );
  }

  const payerPlans = plans.filter((p) => p.payer === payer);
  const shown = payerPlans.filter((p) =>
    p.planName.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <section aria-label={t('planListLabel', { payer })}>
      <button
        type="button"
        className="inline-flex min-h-12 items-center gap-1 rounded-lg pe-3 text-lg font-semibold text-brand underline underline-offset-4"
        onClick={() => {
          setPayer(null);
          setFilter('');
        }}
      >
        <span aria-hidden="true" className="rtl:-scale-x-100">←</span>
        {payer}
      </button>
      <h2 className="mt-4 text-xl font-semibold">{t('planLabel')}</h2>
      {payerPlans.length > 5 ? (
        <div className="mt-3">
          <label htmlFor={filterId} className="sr-only">
            {t('searchPlaceholder')}
          </label>
          <input
            id={filterId}
            type="text"
            placeholder={t('searchPlaceholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={textField}
          />
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p role="status" className="mt-4 text-lg text-ink-muted">
          {t('noMatches')}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {shown.map((plan) => (
            <li key={plan.planId}>
              <button
                type="button"
                className={bigChoice}
                onClick={() =>
                  router.push({
                    pathname: '/doctor',
                    query: { ...baseQuery, plan: plan.planId },
                  })
                }
              >
                {plan.planName}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-lg text-ink-muted">{t('notSure')}</p>
    </section>
  );
}
