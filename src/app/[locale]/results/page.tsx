import { getTranslations } from 'next-intl/server';
import { DemoBanner } from '@/components/DemoBanner';
import { EmptyState } from '@/components/EmptyState';
import { ResultCard } from '@/components/ResultCard';
import { ShareActions } from '@/components/ShareActions';
import { WizardStep } from '@/components/WizardStep';
import { Link } from '@/i18n/navigation';
import { parseWizardParams, wizardQuery } from '@/lib/schemas';
import { searchDoctors } from '@/lib/search';

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseWizardParams(await searchParams);
  const t = await getTranslations('results');
  const { results, mode } = await searchDoctors(params);
  const filtersQuery = wizardQuery(params);

  return (
    <WizardStep
      step={6}
      backHref={{ pathname: '/filters', query: filtersQuery }}
      title={t('title')}
    >
      {mode === 'demo' ? <DemoBanner /> : null}
      <p className="text-xl text-ink-muted">
        {t('subtitle', { count: results.length })}
      </p>

      {results.length === 0 ? (
        <div className="mt-6">
          <EmptyState baseQuery={filtersQuery} />
        </div>
      ) : (
        <>
          <div className="mt-4">
            <ShareActions />
          </div>
          <ul className="mt-2 flex flex-col gap-5">
            {results.map((result) => (
              <ResultCard key={`${result.npi}-${result.planId}`} result={result} />
            ))}
          </ul>
        </>
      )}

      <p className="no-print mt-10 text-center">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center text-lg font-semibold text-brand underline underline-offset-4"
        >
          {t('startOver')}
        </Link>
      </p>
    </WizardStep>
  );
}
