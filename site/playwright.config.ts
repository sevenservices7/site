import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4321', headless: true },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4321/agendamento',
    reuseExistingServer: false,
    env: { PUBLIC_SUPABASE_URL: 'https://booking-tests.invalid', PUBLIC_SUPABASE_ANON_KEY: 'test-only', PUBLIC_FUNCTIONS_URL: 'https://booking-tests.invalid/functions/v1' },
  },
});
