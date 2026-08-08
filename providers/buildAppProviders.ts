import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type {
  MidnightProviders,
  PrivateStateProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { inMemoryPrivateStateProvider } from "./inMemoryPrivateStateProvider";
import { getConfig, PRIVATE_STATE_ID } from "../utils/config";
import type {
  CreatorIdentity,
  QuoteOfTheDayCircuits,
} from "../utils/quote.types";
import {
  createQuotePrivateState,
  type QuotePrivateState,
} from "../utils/witnesses";

export async function buildAppProviders(
  wallet?: ConnectedAPI,
  creatorId?: CreatorIdentity | null,
): Promise<{
  providers: MidnightProviders<any>;
  stateProvider?: PrivateStateProvider<string, QuotePrivateState>;
}> {
  const createPrivateState = (creatorId: CreatorIdentity) =>
    createQuotePrivateState(new Uint8Array(creatorId.secretKey));

  const privateStateProvider = inMemoryPrivateStateProvider<
    string,
    QuotePrivateState
  >();

  if (creatorId) {
    privateStateProvider.setContractAddress(creatorId.contractAddress);
    privateStateProvider.set(PRIVATE_STATE_ID, createPrivateState(creatorId));
  }

  // Dummy wallet for read-only
  const dummyWallet: any = {
    balanceTx: async () => {
      throw new Error("Read-only");
    },
    submitTx: async () => {
      throw new Error("Read-only");
    },
    getCoinPublicKey: () =>
      "0000000000000000000000000000000000000000000000000000000000000000",
    getEncryptionPublicKey: () =>
      "0000000000000000000000000000000000000000000000000000000000000000",
  };
  const walletConfig = await wallet?.getConfiguration();
  // @ts-ignore
  const basePath = import.meta.env?.DEV ? "/contracts/managed/quote-otd" : "";
  const zkConfigProvider = new FetchZkConfigProvider<QuoteOfTheDayCircuits>(
    window.location.origin + basePath,
    fetch.bind(window),
  );
  const config = getConfig();

  setNetworkId(config.networkId);
  return {
    providers: {
      privateStateProvider: privateStateProvider as any,
      publicDataProvider: indexerPublicDataProvider(
        walletConfig ? walletConfig.indexerUri : config.indexer,
        walletConfig ? walletConfig.indexerWsUri : config.indexerWS,
      ),
      zkConfigProvider: zkConfigProvider as any,
      proofProvider: httpClientProofProvider(
        config.proofServer,
        zkConfigProvider as any,
      ),
      walletProvider: wallet ? (wallet as any) : (dummyWallet as any),
      midnightProvider: wallet ? (wallet as any) : (dummyWallet as any),
    },
    ...(privateStateProvider && { stateProvider: privateStateProvider }),
  };
}
