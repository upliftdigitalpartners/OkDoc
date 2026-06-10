import type { Plan } from '../types';

/**
 * Demo plans, shaped like real CMS ContractPlanIDs and real NYC MA plan
 * naming. Served only in mock mode (no Supabase env), behind a demo banner.
 */
export const fixturePlans: Plan[] = [
  {
    planId: 'H3359_021',
    payer: 'Healthfirst',
    planName: 'Healthfirst 65 Plus Plan (HMO)',
    planType: 'HMO',
    counties: ['bronx', 'kings', 'new-york', 'queens', 'richmond', 'nassau', 'westchester'],
  },
  {
    planId: 'H3387_012',
    payer: 'UnitedHealthcare',
    planName: 'AARP Medicare Advantage Choice (PPO)',
    planType: 'PPO',
    counties: ['bronx', 'kings', 'new-york', 'queens', 'richmond', 'nassau', 'westchester'],
  },
  {
    planId: 'H1036_275',
    payer: 'Humana',
    planName: 'Humana Gold Plus (HMO)',
    planType: 'HMO',
    counties: ['bronx', 'kings', 'new-york', 'queens', 'nassau'],
  },
  {
    planId: 'H3330_034',
    payer: 'EmblemHealth',
    planName: 'EmblemHealth VIP Dual (HMO D-SNP)',
    planType: 'HMO D-SNP',
    counties: ['bronx', 'kings', 'new-york', 'queens', 'richmond'],
  },
  {
    planId: 'H0423_001',
    payer: 'MetroPlus Health Plan',
    planName: 'MetroPlus Advantage Plan (HMO D-SNP)',
    planType: 'HMO D-SNP',
    counties: ['bronx', 'kings', 'new-york', 'queens', 'richmond'],
  },
  {
    planId: 'H5599_003',
    payer: 'Aetna',
    planName: 'Aetna Medicare Eagle (PPO)',
    planType: 'PPO',
    counties: ['kings', 'queens', 'nassau', 'westchester'],
  },
];

export function getFixturePlan(planId: string): Plan | undefined {
  return fixturePlans.find((p) => p.planId === planId);
}
