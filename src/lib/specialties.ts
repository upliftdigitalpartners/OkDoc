/**
 * Specialty registry: stable keys (used in URLs and i18n messages) mapped to
 * NUCC taxonomy codes (used at ingest time to classify NPPES/FHIR specialty
 * data). Plain + formal display names live in messages/<locale>.json under
 * `specialties.<key>` so they are translated as concepts.
 */
export const specialtyGroups = [
  'everyday',
  'organs',
  'bones',
  'senses',
  'mind',
] as const;

export type SpecialtyGroup = (typeof specialtyGroups)[number];

export interface Specialty {
  key: string;
  group: SpecialtyGroup;
  taxonomyCodes: string[];
}

export const specialties = [
  { key: 'primary-care', group: 'everyday', taxonomyCodes: ['207Q00000X', '207R00000X'] },
  { key: 'geriatrics', group: 'everyday', taxonomyCodes: ['207RG0300X', '207QG0300X'] },
  { key: 'cardiology', group: 'organs', taxonomyCodes: ['207RC0000X', '207RC0001X'] },
  { key: 'pulmonology', group: 'organs', taxonomyCodes: ['207RP1001X'] },
  { key: 'gastroenterology', group: 'organs', taxonomyCodes: ['207RG0100X'] },
  { key: 'endocrinology', group: 'organs', taxonomyCodes: ['207RE0101X'] },
  { key: 'nephrology', group: 'organs', taxonomyCodes: ['207RN0300X'] },
  { key: 'urology', group: 'organs', taxonomyCodes: ['208800000X'] },
  { key: 'orthopedics', group: 'bones', taxonomyCodes: ['207X00000X'] },
  { key: 'rheumatology', group: 'bones', taxonomyCodes: ['207RR0500X'] },
  { key: 'podiatry', group: 'bones', taxonomyCodes: ['213E00000X'] },
  { key: 'ophthalmology', group: 'senses', taxonomyCodes: ['207W00000X'] },
  { key: 'otolaryngology', group: 'senses', taxonomyCodes: ['207Y00000X'] },
  { key: 'dermatology', group: 'senses', taxonomyCodes: ['207N00000X'] },
  { key: 'neurology', group: 'mind', taxonomyCodes: ['2084N0400X'] },
  { key: 'psychiatry', group: 'mind', taxonomyCodes: ['2084P0800X'] },
] as const satisfies readonly Specialty[];

export type SpecialtyKey = (typeof specialties)[number]['key'];

export const specialtyKeys = specialties.map((s) => s.key) as [
  SpecialtyKey,
  ...SpecialtyKey[],
];

export function taxonomyToSpecialtyKey(code: string): SpecialtyKey | null {
  for (const s of specialties) {
    if ((s.taxonomyCodes as readonly string[]).includes(code)) return s.key;
  }
  return null;
}
