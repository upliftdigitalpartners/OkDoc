'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { locales, localeNames } from '@/i18n/routing';
import { primaryCta, textField } from './buttons';

const DISTANCES = [1, 2, 5, 10] as const;

export function FiltersForm({ baseQuery }: { baseQuery: Record<string, string> }) {
  const t = useTranslations('filters');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const distanceId = useId();
  const languageId = useId();

  const [dist, setDist] = useState('');
  // The "doctor speaks" filter defaults to the UI language when not English.
  const [lang, setLang] = useState(locale === 'en' ? '' : locale);
  const [gender, setGender] = useState('');
  const [newpt, setNewpt] = useState(false);
  const [tele, setTele] = useState(false);
  const [wheel, setWheel] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query: Record<string, string> = { ...baseQuery };
    if (dist) query.dist = dist;
    if (lang) query.lang = lang;
    if (gender) query.gender = gender;
    if (newpt) query.newpt = '1';
    if (tele) query.tele = '1';
    if (wheel) query.wheel = '1';
    router.push({ pathname: '/results', query });
  }

  const selectClass = `${textField} appearance-none`;
  const checkboxRow =
    'flex min-h-14 cursor-pointer items-center gap-4 rounded-2xl border-2 border-line bg-surface px-5 py-3 text-xl';
  const checkboxBox = 'h-7 w-7 shrink-0 accent-[var(--brand)]';

  return (
    <form onSubmit={submit}>
      <div className="flex flex-col gap-6">
        <div>
          <label htmlFor={distanceId} className="block text-xl font-semibold">
            {t('distanceLabel')}
          </label>
          <select
            id={distanceId}
            value={dist}
            onChange={(e) => setDist(e.target.value)}
            className={`${selectClass} mt-2`}
          >
            <option value="">{t('distanceAny')}</option>
            {DISTANCES.map((miles) => (
              <option key={miles} value={miles}>
                {t('distanceMiles', { miles })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={languageId} className="block text-xl font-semibold">
            {t('languageLabel')}
          </label>
          <select
            id={languageId}
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className={`${selectClass} mt-2`}
          >
            <option value="">{t('languageAny')}</option>
            {locales.map((code) => (
              <option key={code} value={code}>
                {localeNames[code]}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-xl font-semibold">{t('genderLabel')}</legend>
          <div className="mt-2 flex flex-col gap-3">
            {[
              ['', t('genderAny')],
              ['f', t('genderFemale')],
              ['m', t('genderMale')],
            ].map(([value, label]) => (
              <label key={value} className={checkboxRow}>
                <input
                  type="radio"
                  name="gender"
                  value={value}
                  checked={gender === value}
                  onChange={() => setGender(value)}
                  className={checkboxBox}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xl font-semibold">{t('extrasLabel')}</legend>
          <div className="mt-2 flex flex-col gap-3">
            <label className={checkboxRow}>
              <input
                type="checkbox"
                checked={newpt}
                onChange={(e) => setNewpt(e.target.checked)}
                className={checkboxBox}
              />
              {t('acceptingNew')}
            </label>
            <label className={checkboxRow}>
              <input
                type="checkbox"
                checked={tele}
                onChange={(e) => setTele(e.target.checked)}
                className={checkboxBox}
              />
              {t('telehealth')}
            </label>
            <label className={checkboxRow}>
              <input
                type="checkbox"
                checked={wheel}
                onChange={(e) => setWheel(e.target.checked)}
                className={checkboxBox}
              />
              {t('wheelchair')}
            </label>
          </div>
        </fieldset>

        <button type="submit" className={primaryCta}>
          {t('showResults')}
        </button>
        <p className="text-center">
          <Link
            href={{ pathname: '/results', query: baseQuery }}
            className="inline-flex min-h-12 items-center text-lg font-semibold text-brand underline underline-offset-4"
          >
            {tCommon('skip')}
          </Link>
        </p>
      </div>
    </form>
  );
}
