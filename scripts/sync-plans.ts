/**
 * Sync the CMS MA plan landscape into the plans table.
 *
 *   npm run sync:plans                # scrape current zip URL, download, load
 *   npm run sync:plans -- --dry-run   # parse + report, no DB writes
 *   npm run sync:plans -- --url=https://www.cms.gov/files/zip/cy2026-landscape-202603.zip
 *
 * Gotchas (verified, docs/DATA_RECON.md): cms.gov 403s non-browser UAs; the
 * zip URL is version-stamped so we scrape the hosting page; CSV is UTF-8 with
 * BOM; Plan/Segment IDs have leading zeros; PDP rows say "All Counties".
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkedUpsert, finishSyncRun, getDb, startSyncRun } from './lib/db';

const HOSTING_PAGE = 'https://www.cms.gov/medicare/coverage/prescription-drug-coverage';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const COUNTY_SLUGS: Record<string, string> = {
  Bronx: 'bronx',
  Kings: 'kings',
  'New York': 'new-york',
  Queens: 'queens',
  Richmond: 'richmond',
  Nassau: 'nassau',
  Westchester: 'westchester',
};
const MA_CATEGORY_TYPES = new Set(['MA', 'MA-PD', 'SNP']);

const flag = (name: string) => process.argv.includes(`--${name}`);
function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function findLandscapeUrl(): Promise<string> {
  const res = await fetch(HOSTING_PAGE, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`Hosting page HTTP ${res.status}`);
  const html = await res.text();
  const matches = [...html.matchAll(/href="(\/files\/zip\/cy(\d{4})-landscape-(\d{6})\.zip)"/g)];
  if (matches.length === 0) {
    throw new Error(
      `No landscape zip link found on ${HOSTING_PAGE} — page layout may have changed; pass --url= explicitly.`,
    );
  }
  matches.sort((a, b) => Number(b[2] + b[3]) - Number(a[2] + a[3]));
  return `https://www.cms.gov${matches[0][1]}`;
}

async function downloadAndExtract(url: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'okdoc-landscape-'));
  const zipPath = join(dir, 'landscape.zip');
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', dir]);
  // The zip nests a folder; find the biggest CSV anywhere under dir.
  let best: { path: string; size: number } | null = null;
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.toLowerCase().endsWith('.csv') && st.size > (best?.size ?? 0)) {
        best = { path: p, size: st.size };
      }
    }
  };
  walk(dir);
  if (!best) throw new Error('No CSV found in landscape zip');
  return (best as { path: string }).path;
}

/** Minimal CSV parser handling quoted fields with embedded commas/newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function main() {
  const url = arg('url') ?? (await findLandscapeUrl());
  const csvPath = arg('csv') ?? (await downloadAndExtract(url));
  console.log(`Parsing ${csvPath}`);
  const text = readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const [header, ...rows] = parseCsv(text);
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`Column "${name}" missing — format changed? Header: ${header.slice(0, 12).join(' | ')}…`);
    return i;
  };
  const iState = col('State Territory Abbreviation');
  const iCounty = col('County Name');
  const iCategory = col('Contract Category Type');
  const iPlanId = col('ContractPlanID');
  const iPayer = col('Organization Marketing Name');
  const iPlanName = col('Plan Name');
  const iPlanType = col('Plan Type');
  const iYear = col('Contract Year');

  const plans = new Map<
    string,
    { plan_id: string; payer: string; plan_name: string; plan_type: string; counties: string[]; contract_year: number }
  >();
  let scanned = 0;
  for (const row of rows) {
    scanned++;
    if (row[iState] !== 'NY') continue;
    if (!MA_CATEGORY_TYPES.has(row[iCategory])) continue;
    const county = COUNTY_SLUGS[row[iCounty]];
    if (!county) continue;
    const planId = row[iPlanId].replace('_', '_'); // already H####_###
    const existing = plans.get(planId);
    if (existing) {
      if (!existing.counties.includes(county)) existing.counties.push(county);
    } else {
      plans.set(planId, {
        plan_id: planId,
        payer: row[iPayer],
        plan_name: row[iPlanName],
        plan_type: row[iPlanType],
        counties: [county],
        contract_year: Number(row[iYear]) || null as unknown as number,
      });
    }
  }
  console.log(`Scanned ${scanned} rows → ${plans.size} MA plans in our 7 counties.`);
  const byPayer = new Map<string, number>();
  for (const p of plans.values()) byPayer.set(p.payer, (byPayer.get(p.payer) ?? 0) + 1);
  console.log('Top payers:', [...byPayer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));

  if (flag('dry-run')) {
    console.log('Dry run — sample:', [...plans.values()].slice(0, 3));
    return;
  }

  const db = getDb();
  const runId = await startSyncRun(db, 'cms-landscape');
  try {
    const upserted = await chunkedUpsert(db, 'plans', [...plans.values()], 'plan_id');
    await finishSyncRun(db, runId, {
      status: 'succeeded',
      rowsUpserted: upserted,
      notes: `source: ${url}`,
    });
    console.log(`✓ upserted ${upserted} plans.`);
  } catch (error) {
    await finishSyncRun(db, runId, { status: 'failed', rowsUpserted: 0, notes: String(error) });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
