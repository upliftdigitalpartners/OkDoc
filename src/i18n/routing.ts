import { defineRouting } from 'next-intl/routing';

export const locales = [
  'en',
  'es',
  'bn',
  'zh',
  'hi',
  'ur',
  'ar',
  'fr',
  'ru',
  'ko',
  'pl',
  'ht',
] as const;

export type Locale = (typeof locales)[number];

export const rtlLocales: ReadonlySet<string> = new Set(['ar', 'ur']);

// Each language named in its own script — shown on the language screen
// and in the "doctor speaks" filter.
export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  bn: 'বাংলা',
  zh: '中文',
  hi: 'हिन्दी',
  ur: 'اردو',
  ar: 'العربية',
  fr: 'Français',
  ru: 'Русский',
  ko: '한국어',
  pl: 'Polski',
  ht: 'Kreyòl Ayisyen',
};

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
});
