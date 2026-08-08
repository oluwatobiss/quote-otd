import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { network } from "./utils/config.js";

const isRemote = network !== "local";

// For remote networks, source secrets (e.g. MIDNIGHT_PREVIEW_SEED) from
// .env.<network> so they don't need to be passed on the command line.
// Shell env still wins over file values.
const envFromFile = isRemote ? loadEnv(network, process.cwd(), "") : {};

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 10 * 60_000,
    hookTimeout: isRemote ? 90 * 60_000 : 15 * 60_000,
    env: envFromFile,
    include: ["src/**/*.test.ts"],
    reporters: ["default"],
    sequence: { concurrent: false },
  },
});
