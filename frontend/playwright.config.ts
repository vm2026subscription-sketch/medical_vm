import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 2,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:4174",
    channel: process.platform === "win32" ? "chrome" : "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 4174 --host 127.0.0.1",
    url: "http://127.0.0.1:4174/login",
    reuseExistingServer: !process.env["CI"],
    timeout: 120000,
  },
});
