import { getTranslations } from 'next-intl/server';
import { SpecialtyPicker } from '@/components/SpecialtyPicker';
import { WizardStep } from '@/components/WizardStep';
import { parseWizardParams, wizardQuery } from '@/lib/schemas';

export default async function DoctorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseWizardParams(await searchParams);
  const t = await getTranslations('doctor');
  const baseQuery = wizardQuery(params, { specialty: undefined });

  return (
    <WizardStep
      step={4}
      backHref={{ pathname: '/plan', query: wizardQuery(params, { plan: undefined }) }}
      title={t('title')}
      help={t('help')}
    >
      <SpecialtyPicker baseQuery={baseQuery} />
    </WizardStep>
  );
}
