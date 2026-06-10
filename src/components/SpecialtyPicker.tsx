'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { specialties, specialtyGroups } from '@/lib/specialties';
import { bigChoice, textField } from './buttons';

export function SpecialtyPicker({ baseQuery }: { baseQuery: Record<string, string> }) {
  const t = useTranslations();
  const searchId = useId();
  const [filter, setFilter] = useState('');

  const needle = filter.trim().toLowerCase();
  const matches = specialties.filter((s) => {
    if (!needle) return true;
    const plain = t(`specialties.${s.key}.plain`).toLowerCase();
    const formal = t(`specialties.${s.key}.formal`).toLowerCase();
    return plain.includes(needle) || formal.includes(needle);
  });

  const groupsToShow = specialtyGroups.filter((g) =>
    matches.some((s) => s.group === g),
  );

  return (
    <div>
      <label htmlFor={searchId} className="sr-only">
        {t('doctor.searchPlaceholder')}
      </label>
      <input
        id={searchId}
        type="text"
        placeholder={t('doctor.searchPlaceholder')}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className={textField}
      />
      {matches.length === 0 ? (
        <p role="status" className="mt-4 text-lg text-ink-muted">
          {t('doctor.noMatches')}
        </p>
      ) : (
        groupsToShow.map((group) => (
          <section key={group} className="mt-6">
            <h2 className="text-lg font-bold uppercase tracking-wide text-ink-muted">
              {t(`specialtyGroups.${group}`)}
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {matches
                .filter((s) => s.group === group)
                .map((s) => (
                  <li key={s.key}>
                    <Link
                      href={{
                        pathname: '/filters',
                        query: { ...baseQuery, specialty: s.key },
                      }}
                      className={bigChoice}
                    >
                      {t(`specialties.${s.key}.plain`)}{' '}
                      <span className="font-normal text-ink-muted">
                        ({t(`specialties.${s.key}.formal`)})
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
