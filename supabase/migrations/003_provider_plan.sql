-- provider_plan: network membership per the payer's own directory.
-- last_seen_at drives freshness labels; rows missing from recent syncs are
-- flagged stale in the UI — never silently deleted.
create table if not exists provider_plan (
  npi text not null references providers (npi) on delete cascade,
  plan_id text not null,
  accepting_new_patients boolean,
  source text not null,           -- payer adapter key, e.g. 'humana'
  last_seen_at timestamptz not null,
  primary key (npi, plan_id)
);

create index if not exists provider_plan_plan_idx on provider_plan (plan_id);
create index if not exists provider_plan_last_seen_idx on provider_plan (last_seen_at);

alter table provider_plan enable row level security;
