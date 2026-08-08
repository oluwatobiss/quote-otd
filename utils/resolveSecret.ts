import { OWNER_LOCAL_SEED } from "./config.js";
import type { WalletSecret } from "./quote.types";

export function resolveSecret(net: string): WalletSecret {
  if (net === "local") return { kind: "seed", value: OWNER_LOCAL_SEED };

  const upperCaseNetwork = net.toUpperCase();
  const mnemonicEnv = `MIDNIGHT_${upperCaseNetwork}_MNEMONIC`;
  const seedEnv = `MIDNIGHT_${upperCaseNetwork}_SEED`;
  const mnemonic = process.env[mnemonicEnv]?.trim().replace(/\s+/g, " ");
  const seedHex = process.env[seedEnv]?.trim();

  if (mnemonic && seedHex) {
    throw new Error(
      `Set only one of ${mnemonicEnv} or ${seedEnv} (both are defined).`,
    );
  }

  if (mnemonic) return { kind: "mnemonic", value: mnemonic };

  if (seedHex) {
    if (!/^[0-9a-fA-F]+$/.test(seedHex) || seedHex.length % 2 !== 0) {
      throw new Error(
        `${seedEnv} must be a hex string of even length (no 0x prefix).`,
      );
    }
    return { kind: "seed", value: seedHex };
  }

  throw new Error(
    `Either ${mnemonicEnv} or ${seedEnv} is required for network '${net}'. ` +
      `Set one in .env.${net} or the shell.`,
  );
}
