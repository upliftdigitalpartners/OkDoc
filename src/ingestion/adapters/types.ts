import type { County } from '../../lib/types';

/** One provider↔network membership row, as the payer's directory states it. */
export interface DirectoryEntry {
  npi: string;
  name: string | null;
  specialtyCode: string | null; // NUCC taxonomy
  languages: string[]; // ISO 639-1, deduped
  address: string | null; // "street, City, ST 12345"
  county: County | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  acceptingNewPatients: boolean | null;
}

export interface DiscoveredNetwork {
  id: string;
  name: string;
}

export interface DiscoveredPlan {
  identifier: string | null; // payer's plan identifier (often embeds CMS contract)
  name: string;
  networks: DiscoveredNetwork[];
}

export interface PayerAdapter {
  /** Key used in provider_plan.source, sync_runs.source, CLI --payer. */
  source: string;
  payerDisplayName: string;
  /** Search the payer's InsurancePlan resources — powers `--discover`. */
  discoverPlans(query: string): Promise<DiscoveredPlan[]>;
  /**
   * Stream NYC-metro directory entries for one network. Implementations
   * filter to our coverage area and our specialty registry (or the given
   * subset of NUCC codes — used by --specialty for scoped/test runs).
   */
  fetchNetworkEntries(
    networkId: string,
    taxonomyCodes?: string[],
  ): AsyncGenerator<DirectoryEntry>;
}

/** Curated entry in plan-network-map.json. */
export interface PlanNetworkMapping {
  planId: string; // CMS ContractPlanID, e.g. H3533_027 — joins to plans table
  planName: string; // for humans reading the map
  networkIds: string[];
  note?: string;
}

export interface PayerMapConfig {
  payer: string;
  plans: PlanNetworkMapping[];
}
