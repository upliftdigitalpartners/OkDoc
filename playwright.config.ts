import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    // Test against a production build, not the dev server: dev compiles
    // routes on first hit, which races axe and yields flaky results. This
    // also exercises the real output (security headers, SW, static gen).
    // CI builds in a prior step and sets PW_NO_BUILD to skip the rebuild.
    command: process.env.PW_NO_BUILD ? 'npm run start' : 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
