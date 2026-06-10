import { z } from 'zod';
import { specialtyKeys } from './specialties';
import { counties } from './types';

/**
 * Wizard state lives in URL query params so every step (and the results page)
 * is shareable and back-button-friendly. Invalid values are dropped, never
 * thrown: a mangled shared link should still render the closest sane screen.
 */
const lenient = <T extends z.ZodType>(schema: T) =>
  schema.optional().catch(undefined);

export const wizardParamsSchema = z.object({
  county: lenient(z.enum(counties)),
  zip: lenient(z.string().regex(/^\d{5}$/)),
  plan: lenient(z.string().min(1).max(40)),
  specialty: lenient(z.enum(specialtyKeys)),
  dist: lenient(z.coerce.number().int().min(1).max(100)),
  lang: lenient(z.string().regex(/^[a-z]{2}$/)),
  gender: lenient(z.enum(['f', 'm'])),
  newpt: lenient(z.literal('1')),
  tele: lenient(z.literal('1')),
  wheel: lenient(z.literal('1')),
});

export type WizardParams = z.infer<typeof wizardParamsSchema>;

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseWizardParams(raw: RawSearchParams): WizardParams {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }
  return wizardParamsSchema.parse(flat);
}

/** Query object for next-intl <Link>, with undefined values dropped. */
export function wizardQuery(
  params: WizardParams,
  overrides: Partial<WizardParams> = {},
): Record<string, string> {
  const merged = { ...params, ...overrides };
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) query[key] = String(value);
  }
  return query;
}
