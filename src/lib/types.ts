import type { SpecialtyKey } from './specialties';

export const counties = [
  'bronx',
  'kings',
  'new-york',
  'queens',
  'richmond',
  'nassau',
  'westchester',
] as const;

export type County = (typeof counties)[number];

export interface Plan {
  planId: string;
  payer: string;
  planName: string;
  planType: string;
  counties: County[];
}

/** A provider's membership in one plan's network, per that payer's directory. */
export interface ProviderPlanLink {
  planId: string;
  acceptingNewPatients: boolean | null;
  source: string;
  lastSeenAt: string; // ISO date
}

export interface Provider {
  npi: string;
  name: string;
  specialty: SpecialtyKey;
  gender: 'f' | 'm' | null;
  languages: string[]; // ISO 639-1 codes, always includes 'en'
  address: string;
  county: County;
  lat: number;
  lng: number;
  phone: string; // E.164-ish digits
  wheelchairAccessible: boolean | null;
  telehealth: boolean | null;
  plans: ProviderPlanLink[];
}

/** Flattened, UI-ready search hit. */
export interface DoctorResult {
  npi: string;
  name: string;
  specialty: SpecialtyKey;
  gender: 'f' | 'm' | null;
  languages: string[];
  address: string;
  phone: string;
  wheelchairAccessible: boolean | null;
  telehealth: boolean | null;
  distanceMiles: number | null;
  payer: string;
  planId: string;
  planName: string;
  acceptingNewPatients: boolean | null;
  lastSeenAt: string;
  stale: boolean;
}

export interface SearchOutcome {
  results: DoctorResult[];
  mode: 'demo' | 'live';
}
