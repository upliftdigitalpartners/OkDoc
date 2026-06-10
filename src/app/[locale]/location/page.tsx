import { useTranslations } from 'next-intl';
import { WizardStep } from '@/components/WizardStep';
import { ZipForm } from '@/components/ZipForm';
import { bigChoice } from '@/components/buttons';
import { Link } from '@/i18n/navigation';
import { counties } from '@/lib/types';

export default function LocationPage() {
  const t = useTranslations('location');
  const tCounties = useTranslations('counties');

  return (
    <WizardStep step={2} backHref="/" title={t('title')} help={t('help')}>
      <ul
        aria-label={t('countyListLabel')}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {counties.map((county) => (
          <li key={county}>
            <Link
              href={{ pathname: '/plan', query: { county } }}
              className={bigChoice}
            >
              {tCounties(county)}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 border-t border-line pt-6">
        <ZipForm baseQuery={{}} />
      </div>
    </WizardStep>
  );
}
