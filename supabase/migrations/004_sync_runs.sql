-- sync_runs: one row per ingestion run, for observability and debugging.
create table if not exists sync_runs (
  id bigint generated always as identity primary key,
  source text not null,           -- 'cms-landscape' | 'nppes' | 'humana' | 'uhc' | ...
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_upserted integer not null default 0,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  notes text
);

alter table sync_runs enable row level security;
