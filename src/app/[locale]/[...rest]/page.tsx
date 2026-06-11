import { notFound } from 'next/navigation';

// Any unmatched path under a locale renders the localized not-found page
// (without this catch-all, Next falls back to its built-in English 404).
export default function CatchAll() {
  notFound();
}
