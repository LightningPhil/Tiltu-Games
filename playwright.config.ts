import { defineConfig, devices } from '@playwright/test';

const remote = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: remote || 'http://127.0.0.1:5197/Tiltu-Games/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      channel: process.env.PLAYWRIGHT_CHANNEL,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: remote ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 5197 --strictPort --base /Tiltu-Games/',
    url: 'http://127.0.0.1:5197/Tiltu-Games/',
    reuseExistingServer: false,
  },
});
