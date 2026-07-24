import { type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { type MidnightWalletProvider } from "./wallet.js";
import { type NetworkConfig } from "./config.js";

export type QuoteOfTheDayCircuits = "post" | "publicKey";

export type QuoteOfTheDayProviders = MidnightProviders<any>;

export function buildProviders(
  wallet: MidnightWalletProvider,
  zkConfigPath: string,
  config: NetworkConfig,
): QuoteOfTheDayProviders {
  const zkConfigProvider = new NodeZkConfigProvider<QuoteOfTheDayCircuits>(
    zkConfigPath,
  );

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `quote-otd-${Date.now()}`,
      privateStoragePasswordProvider: () => "Quote-OTD-Test-Password",
      accountId: wallet.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      config.proofServer,
      zkConfigProvider,
    ),
    walletProvider: wallet,
    midnightProvider: wallet,
  };
}
