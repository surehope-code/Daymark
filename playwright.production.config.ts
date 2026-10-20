import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./deployment-tests",
  use: { baseURL: "http://127.0.0.1:4173", channel: "msedge" },
  webServer: {
    command: "npm run preview -- --port 4173 --base /Daymark/",
    url: "http://127.0.0.1:4173/Daymark/",
    reuseExistingServer: false,
  },
});
