'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { secondaryAction } from './buttons';

/** Share (native share sheet, clipboard fallback) + Print. */
export function ShareActions() {
  const t = useTranslations('results');
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch {
        // User closed the share sheet — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard unavailable (e.g. http) — nothing more we can do.
    }
  }

  return (
    <div className="no-print">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={share} className={secondaryAction}>
          <span aria-hidden="true">↗</span> {t('share')}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className={secondaryAction}
        >
          <span aria-hidden="true">🖨</span> {t('print')}
        </button>
      </div>
      <p role="status" className="mt-2 min-h-7 text-lg font-semibold text-ok">
        {copied ? t('shareCopied') : ''}
      </p>
    </div>
  );
}
