import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": {},
  },
  optimizeDeps: {
    exclude: [
      "@midnight-ntwrk/midnight-js-contracts",
      "@midnight-ntwrk/ledger-v8",
      "@midnight-ntwrk/zkir-v2",
      "@midnight-ntwrk/onchain-runtime-v3",
    ],
  },
  build: {
    target: "esnext",
  },
});
