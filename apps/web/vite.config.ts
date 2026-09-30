import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { seoFiles } from "./vite-plugins/seoFiles.ts";
import { isSiteId, PORTAL, siteById } from "./src/sites/sites.ts";

// https://vite.dev/config/
/** One `.env` at the repository root serves every app; only VITE_* values reach the browser. */
const envDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  // API_PORT is read here for the dev proxy only; it is not exposed to the browser (envPrefix stays VITE_).
  const env = loadEnv(mode, envDir, ["VITE_", "API_"]);
  const siteId = env.VITE_SITE?.trim();
  if (siteId && !isSiteId(siteId)) throw new Error("VITE_SITE must be portal or traptheorb");
  const site = siteId && isSiteId(siteId) ? siteById(siteId) : PORTAL;
  /** The API runs next to Vite in development; same-origin /api keeps auth cookies first-party. */
  const apiProxy = { "/api": { target: `http://localhost:${env.API_PORT || "3102"}` } };

  return {
    plugins: [
      react(),
      tailwindcss(),
      seoFiles({
        site,
        siteUrl: env.VITE_SITE_URL?.trim() || site.url,
        adsenseClient: env.VITE_ADSENSE_CLIENT,
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    envDir,
    build: {
      target: "es2022",
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      restoreMocks: true,
      // The App tests render the whole site and load lazy chunks; with coverage on and the
      // whole workspace testing in parallel they need more than the 5 s default.
      testTimeout: 15_000,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/test/**",
          "src/main.tsx",
          "src/env.d.ts",
        ],
        reporter: ["text-summary", "text", "html"],
        thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
    },
    // set port
    server: {
      port: 3101,
      proxy: apiProxy,
    },
    preview: {
      proxy: apiProxy,
    },
  };
});
