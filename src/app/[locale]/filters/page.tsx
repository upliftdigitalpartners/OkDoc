import { getTranslations } from 'next-intl/server';
import { FiltersForm } from '@/components/FiltersForm';
import { WizardStep } from '@/components/WizardStep';
import { parseWizardParams, wizardQuery } from '@/lib/schemas';

export default async function FiltersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseWizardParams(await searchParams);
  const t = await getTranslations('filters');
  const baseQuery = wizardQuery(params, {
    dist: undefined,
    lang: undefined,
    gender: undefined,
    newpt: undefined,
    tele: undefined,
    wheel: undefined,
  });

  return (
    <WizardStep
      step={5}
      backHref={{
        pathname: '/doctor',
        query: wizardQuery(params, { specialty: undefined }),
      }}
      title={t('title')}
      help={t('help')}
    >
      <FiltersForm baseQuery={baseQuery} />
    </WizardStep>
  );
}
