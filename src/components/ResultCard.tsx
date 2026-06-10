import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { directionsHref, formatUsPhone, telHref } from '@/lib/format';
import type { DoctorResult } from '@/lib/types';
import { primaryCta, secondaryAction } from './buttons';

function Badge({
  icon,
  children,
  tone = 'neutral',
}: {
  icon: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'ok';
}) {
  const tones = {
    neutral: 'border-line bg-brand-soft text-ink',
    ok: 'border-ok bg-ok-soft text-ok',
  };
  return (
    <li
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-base font-semibold ${tones[tone]}`}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </li>
  );
}

export async function ResultCard({ result }: { result: DoctorResult }) {
  const locale = await getLocale();
  const t = await getTranslations('results');
  const tSpec = await getTranslations('specialties');
  const tLang = await getTranslations('languages');
  // Confirm script is shown bilingual: user's language + English, so the
  // caregiver or the office staff can always read one of them.
  const tEn = await getTranslations({ locale: 'en', namespace: 'results' });
  const format = await getFormatter();

  const headingId = `doc-${result.npi}`;
  // lastSeenAt may be a bare date (fixtures) or a timestamptz (live data);
  // format in UTC so a bare date never shifts to the previous day.
  const syncedDate = format.dateTime(new Date(result.lastSeenAt), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const script = (tr: typeof t) =>
    tr('confirmScript', { plan: result.planName, doctor: result.name });

  const spokenLanguages = result.languages
    .filter((code) => code !== 'en')
    .map((code) => tLang(code as Parameters<typeof tLang>[0]));

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className="rounded-2xl border-2 border-line bg-surface p-5 shadow-sm"
      >
        <h3 id={headingId} className="text-2xl font-bold">
          {result.name}
        </h3>
        <p className="mt-1 text-xl">
          {tSpec(`${result.specialty}.plain`)}{' '}
          <span className="text-ink-muted">
            ({tSpec(`${result.specialty}.formal`)})
          </span>
        </p>
        <p className="mt-2 text-lg text-ink-muted">
          {result.distanceMiles !== null ? (
            <>
              {t('distanceAway', {
                miles: Number(result.distanceMiles.toFixed(1)),
              })}
              {' · '}
            </>
          ) : null}
          {result.address}
        </p>

        <p className="mt-3 border-s-4 border-brand ps-3 text-base text-ink-muted">
          {t('trustLabel', { payer: result.payer })} ·{' '}
          {t('syncedOn', { date: syncedDate })}
        </p>
        {result.stale ? (
          <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-base font-semibold text-warn">
            <span aria-hidden="true">⚠</span> {t('staleWarning')}
          </p>
        ) : null}

        <ul className="mt-3 flex flex-wrap gap-2">
          {result.acceptingNewPatients === true ? (
            <Badge icon="✓" tone="ok">
              {t('acceptingBadge')}
            </Badge>
          ) : null}
          {spokenLanguages.length > 0 ? (
            <Badge icon="🗣">
              {t('speaksBadge', {
                languages: format.list(spokenLanguages, { type: 'conjunction' }),
              })}
            </Badge>
          ) : null}
          {result.gender ? (
            <Badge icon="👤">
              {result.gender === 'f' ? t('femaleDoctor') : t('maleDoctor')}
            </Badge>
          ) : null}
          {result.telehealth === true ? (
            <Badge icon="🎥">{t('telehealthBadge')}</Badge>
          ) : null}
          {result.wheelchairAccessible === true ? (
            <Badge icon="♿">{t('wheelchairBadge')}</Badge>
          ) : null}
        </ul>

        <a href={telHref(result.phone)} className={`${primaryCta} mt-5`}>
          <span aria-hidden="true">📞</span>
          {t('callButton')} · {formatUsPhone(result.phone)}
        </a>

        <details className="mt-4 rounded-xl border border-line bg-paper px-4 py-3">
          <summary className="min-h-12 cursor-pointer py-1 text-lg font-semibold text-brand">
            {t('confirmTitle')}
          </summary>
          <p className="mt-2 text-lg">“{script(t)}”</p>
          {locale !== 'en' ? (
            <p className="mt-2 text-lg text-ink-muted" lang="en">
              “{script(tEn)}”
            </p>
          ) : null}
        </details>

        <div className="mt-4 flex flex-wrap items-start gap-3">
          <a
            href={directionsHref(result.address)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${secondaryAction} no-print`}
          >
            <span aria-hidden="true">🧭</span>
            {t('directions')}
            <span className="sr-only"> — {result.name}</span>
          </a>
        </div>
      </article>
    </li>
  );
}
