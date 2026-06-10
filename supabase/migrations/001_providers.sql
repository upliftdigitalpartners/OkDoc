-- providers: one row per NPI, enriched from NPPES. Lean on purpose
-- (Supabase free tier): only fields the UI renders.
create table if not exists providers (
  npi text primary key,
  name text not null,
  specialty_key text,             -- OkDoc registry key (src/lib/specialties.ts)
  specialty_code text,            -- NUCC taxonomy code (primary)
  gender text check (gender in ('f', 'm')),
  languages text[] not null default '{}',  -- ISO 639-1
  address text,
  county text,                    -- okdoc county slug (bronx, kings, ...)
  lat double precision,
  lng double precision,
  phone text,
  wheelchair_accessible boolean,
  telehealth boolean,
  nppes_enriched_at timestamptz,  -- null = NPPES enrichment still pending
  updated_at timestamptz not null default now()
);

create index if not exists providers_specialty_idx on providers (specialty_key);
create index if not exists providers_county_idx on providers (county);

-- Service-role access only; RLS on with no policies blocks anon/authed reads.
alter table providers enable row level security;
