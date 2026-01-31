import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Electron app testing
 * Supports E2E testing of the Anki Generator desktop application
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
  timeout: 5 * 60 * 1000, // 5 minutes for full pipeline execution
  expect: {
    timeout: 10 * 1000, // 10 seconds for individual assertions
  },
  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'Electron',
      use: {
        ...devices['desktop-chromium'],
      },
    },
  ],

  webServer: undefined, // Electron app is launched manually in tests
})
