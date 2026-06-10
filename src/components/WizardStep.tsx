import { useTranslations } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { ProgressDots } from './ProgressDots';

type LinkHref = ComponentProps<typeof Link>['href'];

interface Props {
  step: number;
  backHref?: LinkHref;
  title: string;
  help?: string;
  children: ReactNode;
}

export function WizardStep({ step, backHref, title, help, children }: Props) {
  const t = useTranslations('common');
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-12">
      <div className="flex min-h-12 items-center justify-between gap-4">
        {backHref ? (
          <Link
            href={backHref}
            className="no-print inline-flex min-h-12 items-center gap-1 rounded-lg pe-3 text-lg font-semibold text-brand underline underline-offset-4"
          >
            <span aria-hidden="true" className="rtl:-scale-x-100">←</span>
            {t('back')}
          </Link>
        ) : (
          <span />
        )}
      </div>
      <ProgressDots step={step} />
      <h1 className="mt-2 text-3xl font-bold leading-tight">{title}</h1>
      {help ? <p className="mt-3 text-xl text-ink-muted">{help}</p> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}
