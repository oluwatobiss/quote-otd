import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import {
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
  Transaction,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type {
  MidnightProvider,
  MidnightProviders,
  PrivateStateProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { toHex, fromHex } from "@midnight-ntwrk/midnight-js-utils";
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

export class DappConnectorWalletProvider
  implements WalletProvider, MidnightProvider
{
  constructor(private readonly connectedAPI: ConnectedAPI) {}

  async balanceTx(
    tx: UnboundTransaction,
    _ttl?: Date,
  ): Promise<FinalizedTransaction> {
    const txHex = toHex(tx.serialize());
    const { tx: balancedTxHex } =
      await this.connectedAPI.balanceUnsealedTransaction(txHex, {
        payFees: true,
      });

    return Transaction.deserialize(
      "signature",
      "proof",
      "binding",
      fromHex(balancedTxHex),
    );
  }

  async submitTx(tx: FinalizedTransaction): Promise<string> {
    const txHex = toHex(tx.serialize());
    await this.connectedAPI.submitTransaction(txHex);
    return tx.identifiers()[0];
  }

  getCoinPublicKey(): CoinPublicKey {
    return "0000000000000000000000000000000000000000000000000000000000000000" as unknown as CoinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return "0000000000000000000000000000000000000000000000000000000000000000" as unknown as EncPublicKey;
  }
}

export async function buildBrowserProviders(
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

  const walletProvider = wallet
    ? new DappConnectorWalletProvider(wallet)
    : undefined;

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

  const proofServerUrl = new URL(config.proofServer);
  if (
    proofServerUrl.hostname !== "127.0.0.1" &&
    proofServerUrl.hostname !== "localhost"
  ) {
    throw new Error(
      `Privacy violation: Proof server must be a local loopback address. Found: ${config.proofServer}`,
    );
  }

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
      walletProvider: walletProvider
        ? (walletProvider as any)
        : (dummyWallet as any),
      midnightProvider: walletProvider
        ? (walletProvider as any)
        : (dummyWallet as any),
    },
    ...(privateStateProvider && { stateProvider: privateStateProvider }),
  };
}
