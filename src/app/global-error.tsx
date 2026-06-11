'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary: shown only when the root layout itself throws, so it
 * renders its own <html>/<body> with no providers, fonts, or locale. Kept
 * deliberately minimal and multilingual-lite.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary:', error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#f6f4ef',
          color: '#1c2a36',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100dvh',
          margin: 0,
          padding: 24,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        <main style={{ maxWidth: '34rem' }}>
          <h1 style={{ color: '#086275', fontSize: '1.75rem' }}>OkDoc</h1>
          <p style={{ fontSize: '1.25rem' }}>
            Something went wrong. Please try again.
          </p>
          <p style={{ fontSize: '1.1rem', color: '#4e5f6d' }}>
            حدث خطأ ما. · Algo salió mal. · 出错了。
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              minHeight: 56,
              padding: '0 24px',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#fff',
              background: '#086275',
              border: 'none',
              borderRadius: 16,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
