/**
 * Validates every locale catalog against messages/en.json:
 *  - identical key structure (no missing, no extra keys)
 *  - ICU placeholders used in English appear in the translation
 * Run: npm run check:i18n
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'messages');
const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8'));

function keyPaths(obj, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') out.push(...keyPaths(value, path));
    else out.push(path);
  }
  return out;
}

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

// Placeholder names referenced in an ICU string: {miles}, {count, plural ...}
function placeholders(value) {
  const names = new Set();
  for (const match of String(value).matchAll(/\{(\w+)/g)) names.add(match[1]);
  return names;
}

const enPaths = keyPaths(en);
let failed = false;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  if (file === 'en.json') continue;
  const locale = file.replace('.json', '');
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch (error) {
    console.error(`✗ ${locale}: invalid JSON — ${error.message}`);
    failed = true;
    continue;
  }

  const paths = keyPaths(catalog);
  const missing = enPaths.filter((p) => !paths.includes(p));
  const extra = paths.filter((p) => !enPaths.includes(p));
  const badPlaceholders = [];

  for (const path of enPaths) {
    if (path.endsWith('.//') || path === '//' || path.includes('."//"')) continue;
    const enValue = get(en, path);
    const value = get(catalog, path);
    if (typeof enValue !== 'string' || typeof value !== 'string') continue;
    const expected = placeholders(enValue);
    const actual = placeholders(value);
    for (const name of expected) {
      if (!actual.has(name)) badPlaceholders.push(`${path}: missing {${name}}`);
    }
  }

  if (missing.length || extra.length || badPlaceholders.length) {
    failed = true;
    console.error(`✗ ${locale}:`);
    for (const p of missing) console.error(`    missing key: ${p}`);
    for (const p of extra) console.error(`    extra key:   ${p}`);
    for (const p of badPlaceholders) console.error(`    ${p}`);
  } else {
    console.log(`✓ ${locale}: ${paths.length} keys, structure + placeholders OK`);
  }
}

process.exit(failed ? 1 : 0);
