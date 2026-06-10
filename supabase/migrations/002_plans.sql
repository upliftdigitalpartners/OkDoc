-- plans: CMS MA landscape rows for our coverage area, one row per
-- ContractPlanID (segments collapsed), counties aggregated.
create table if not exists plans (
  plan_id text primary key,       -- ContractPlanID, e.g. H3359_021
  payer text not null,            -- Organization Marketing Name
  plan_name text not null,
  plan_type text,                 -- HMO, PPO, HMO D-SNP, ...
  counties text[] not null default '{}',  -- okdoc county slugs
  contract_year int,
  updated_at timestamptz not null default now()
);

create index if not exists plans_payer_idx on plans (payer);

alter table plans enable row level security;
