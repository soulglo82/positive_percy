// Batch D: layout and accessibility checks in a real browser (CI job "ui").
// Needs a Postgres in E2E_DATABASE_URL; the server is built and started here.
import { defineConfig } from '@playwright/test';

const PORT = 3300;
const touch = { hasTouch: true, isMobile: true };

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  timeout: 120000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, reducedMotion: 'reduce' },
  projects: [
    { name: 'phone-320', use: { viewport: { width: 320, height: 568 } } },
    { name: 'phone-390-touch', use: { viewport: { width: 390, height: 844 }, ...touch } },
    { name: 'ipad-834-touch', use: { viewport: { width: 834, height: 1194 }, ...touch } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'node server/index.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/percy_e2e',
      JWT_SECRET: 'e2e-secret-0123456789abcdef0123456789abcdef',
      PORT: String(PORT),
    },
  },
});
