import type { FhirResource } from '../fhir';

/** NPI from a Practitioner's identifiers (system us-npi, 10 digits). */
export function npiOf(practitioner: FhirResource | undefined): string | null {
  const id = (practitioner?.identifier ?? []).find(
    (i: FhirResource) => i.system === 'http://hl7.org/fhir/sid/us-npi',
  );
  return typeof id?.value === 'string' && /^\d{10}$/.test(id.value)
    ? id.value
    : null;
}

/** Plan-Net newpatients extension → tri-state accepting flag. */
export function acceptingOf(role: FhirResource): boolean | null {
  const ext = (role.extension ?? []).find((x: FhirResource) =>
    String(x.url).endsWith('/newpatients'),
  );
  const code = ext?.extension?.find(
    (x: FhirResource) => x.url === 'acceptingPatients',
  )?.valueCodeableConcept?.coding?.[0]?.code;
  if (code === 'newpt') return true;
  if (code === 'nopt') return false;
  if (typeof code === 'string') return code.startsWith('existpt') ? false : null;
  return null;
}

/** Language display names (payers use prose, not codes) → ISO 639-1. */
const LANGUAGE_NAMES: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  castilian: 'es', // UHC's BCP-47 display for Spanish
  bengali: 'bn',
  chinese: 'zh',
  mandarin: 'zh',
  cantonese: 'zh',
  hindi: 'hi',
  urdu: 'ur',
  arabic: 'ar',
  french: 'fr',
  russian: 'ru',
  korean: 'ko',
  polish: 'pl',
  'haitian creole': 'ht',
  'haitian': 'ht',
  creole: 'ht',
};

export function languagesOf(practitioner: FhirResource | undefined): string[] {
  const out = new Set<string>(['en']);
  for (const comm of practitioner?.communication ?? []) {
    for (const coding of comm?.coding ?? []) {
      const display = coding?.display;
      if (typeof display === 'string') {
        const code = LANGUAGE_NAMES[display.trim().toLowerCase()];
        if (code) out.add(code);
      }
    }
  }
  return [...out];
}

/** Last path segment of a FHIR reference ("...Practitioner/abc" → "abc"). */
export function refId(reference: unknown): string {
  return String(reference ?? '').split('/').pop() ?? '';
}

/** First 10-digit phone in a telecom array, normalized to bare digits. */
export function phoneOf(telecom: FhirResource[] | undefined): string | null {
  for (const t of telecom ?? []) {
    if (t.system !== 'phone' || typeof t.value !== 'string') continue;
    let digits = t.value.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    if (digits.length === 10) return digits;
  }
  return null;
}
