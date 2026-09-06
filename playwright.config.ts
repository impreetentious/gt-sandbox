import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4002";

// End-to-end runs against the built export served by `serve`, not the dev server,
// so the suite exercises the same bytes the host will publish.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // A stray `test.only` would cut the browser gate to one test and still report
  // green. Vitest already refuses `.only` under CI by default; this gives the
  // Playwright suite the same guarantee.
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm serve:export",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
