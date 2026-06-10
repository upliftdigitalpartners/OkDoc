import { useTranslations } from 'next-intl';

export const WIZARD_TOTAL_STEPS = 6;

export function ProgressDots({ step }: { step: number }) {
  const t = useTranslations('common');
  return (
    <p className="my-4">
      <span className="sr-only">
        {t('stepLabel', { step, total: WIZARD_TOTAL_STEPS })}
      </span>
      <span aria-hidden="true" className="flex gap-2">
        {Array.from({ length: WIZARD_TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${
              i < step ? 'bg-brand' : 'border-2 border-line bg-surface'
            }`}
          />
        ))}
      </span>
    </p>
  );
}
