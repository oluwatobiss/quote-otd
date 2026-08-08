import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { MidnightWalletProvider } from "./walletProviders";
import type { NetworkConfig } from "../utils/config";
import type { QuoteOfTheDayCircuits } from "../utils/quote.types";

export type QuoteProviders = MidnightProviders<any>;

export function buildProviders(
  wallet: MidnightWalletProvider,
  zkConfigPath: string,
  config: NetworkConfig,
): QuoteProviders {
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
