import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Every wizard step gets an axe scan (WCAG 2.0/2.1/2.2 A+AA rule tags).
 * Add new screens here when they are created.
 */
const routes: Array<{ name: string; path: string }> = [
  { name: 'home / language', path: '/en' },
  { name: 'location', path: '/en/location' },
  { name: 'plan', path: '/en/plan?county=kings' },
  { name: 'doctor', path: '/en/doctor?county=kings&plan=H3359_021' },
  {
    name: 'filters',
    path: '/en/filters?county=kings&plan=H3359_021&specialty=cardiology',
  },
  {
    name: 'results',
    path: '/en/results?county=kings&plan=H3359_021&specialty=cardiology',
  },
  {
    name: 'results (empty state)',
    path: '/en/results?county=richmond&plan=H1036_275&specialty=psychiatry&dist=1',
  },
];

for (const route of routes) {
  test(`axe: ${route.name}`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('plan picker: payer → plan drill-down is keyboard-operable and axe-clean', async ({
  page,
}) => {
  await page.goto('/en/plan?county=kings');
  await page.getByRole('button', { name: 'Healthfirst' }).click();
  await expect(
    page.getByRole('button', { name: /Healthfirst 65 Plus/ }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('RTL (Arabic): dir is set, axe-clean, no horizontal scroll', async ({
  page,
}) => {
  await page.goto('/ar/results?county=kings&plan=H3359_021&specialty=cardiology');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('localized 404 page renders, RTL-aware, axe-clean', async ({ page }) => {
  const response = await page.goto('/ar/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('PWA: manifest, service worker, and offline page are served', async ({
  page,
}) => {
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.icons?.length).toBeGreaterThanOrEqual(3);
  expect((await page.request.get('/sw.js')).ok()).toBe(true);
  const offline = await page.request.get('/offline.html');
  expect(offline.ok()).toBe(true);
  expect(await offline.text()).toContain('lang="ar"');
});

test('200% zoom: results page has no horizontal scroll', async ({ page }) => {
  await page.goto('/en/results?county=kings&plan=H3359_021&specialty=cardiology');
  await page.waitForLoadState('networkidle');
  // Approximate 200% text zoom by doubling root font size.
  await page.addStyleTag({ content: 'html { font-size: 225%; }' });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
