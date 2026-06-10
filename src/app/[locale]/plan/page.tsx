import { getTranslations } from 'next-intl/server';
import { PlanPicker } from '@/components/PlanPicker';
import { WizardStep } from '@/components/WizardStep';
import { parseWizardParams, wizardQuery } from '@/lib/schemas';
import { getPlans } from '@/lib/search';
import { zipToCounty } from '@/lib/geo';

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseWizardParams(await searchParams);
  const t = await getTranslations('plan');
  const county =
    params.county ?? (params.zip ? (zipToCounty(params.zip) ?? undefined) : undefined);
  const plans = await getPlans(county);
  const baseQuery = wizardQuery(params, { plan: undefined });

  return (
    <WizardStep step={3} backHref="/location" title={t('title')} help={t('help')}>
      <PlanPicker plans={plans} baseQuery={baseQuery} />
    </WizardStep>
  );
}
