import { Transaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type {
  PrivateStateProvider,
  MidnightProviders,
} from "@midnight-ntwrk/midnight-js-types";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { getConfig } from "./config";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import {
  createQuoteOTDPrivateState,
  type QuoteOTDPrivateState,
} from "./witnesses";
import { inMemoryPrivateStateProvider } from "./inMemoryPrivateStateProvider.js";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import { CompiledQuoteOfTheDayContract } from "../contracts/index.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { toHex, fromHex } from "@midnight-ntwrk/midnight-js-utils";
export type QuoteOfTheDayCircuits = "post" | "publicKey";

export function listWallets(): InitialAPI[] {
  // @ts-ignore
  const injected = window.midnight;
  return injected ? Object.values(injected) : [];
}

export function selectWallet(): InitialAPI {
  const wallets = listWallets();
  if (wallets.length === 0) {
    throw new Error(
      "No Midnight wallet found. Please install a Midnight wallet extension.",
    );
  }
  return wallets[0];
}

export async function connectBrowserWallet(
  wallet: InitialAPI,
): Promise<ConnectedAPI> {
  console.log("Connect button clicked");

  // Connect to the specified network (use 'undeployed' for local development)
  // const connectedApi = await wallet.connect("undeployed");
  const connectedApi = await wallet.connect("preview");
  // const connectedApi = await wallet.connect("preprod");

  // Optional: Get the service URI configuration
  const serviceUriConfig = await connectedApi.getConfiguration();
  console.log("Service URI Config:", serviceUriConfig);

  const connectionStatus = await connectedApi.getConnectionStatus();
  if (connectionStatus.status === "connected") {
    // Hint usage to prompt the user for permissions
    try {
      await connectedApi.hintUsage([
        "balanceUnsealedTransaction",
        "balanceSealedTransaction",
        "submitTransaction",
        "getShieldedAddresses",
        "getUnshieldedAddress",
      ]);
    } catch (e) {
      console.warn("hintUsage failed or not supported by wallet", e);
    }

    // Retrieve the unshielded address from the wallet
    const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
    const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
      await connectedApi.getShieldedAddresses();

    // The Midnight JS SDK expects synchronous getCoinPublicKey methods on the WalletProvider.
    // The DApp connector provides them asynchronously, so we polyfill them here.
    (connectedApi as any).getCoinPublicKey = () => shieldedCoinPublicKey;
    (connectedApi as any).getEncryptionPublicKey = () =>
      shieldedEncryptionPublicKey;

    // Polyfill WalletProvider methods
    (connectedApi as any).balanceTx = async (tx: any, newCoins: any) => {
      const txStr = toHex(tx.serialize());
      const balanced = await connectedApi.balanceUnsealedTransaction(txStr);
      return Transaction.deserialize(
        "signature",
        "proof",
        "binding",
        fromHex(balanced.tx),
      );
    };
    (connectedApi as any).submitTx = async (tx: any) => {
      const txStr = toHex(tx.serialize());
      const walletHash = (await connectedApi.submitTransaction(txStr)) as any;
      if (typeof walletHash === "string" && walletHash.trim() !== "") {
        return walletHash;
      }
      if (walletHash && typeof walletHash === "object") {
        if (typeof walletHash.txHash === "string") return walletHash.txHash;
        if (typeof walletHash.hash === "string") return walletHash.hash;
      }
      const hash = tx.transactionHash();
      return typeof hash === "string" ? hash : toHex(hash);
    };

    console.log({
      isConnected: true,
      walletAddress: unshieldedAddress,
    });
  }

  return connectedApi;
}

// --- MEMORY PRIVATE STATE PROVIDER ---
// @ts-ignore
export class MemoryPrivateStateProvider implements PrivateStateProvider<
  string,
  any
> {
  private state: any;
  private signingKey: any = null;

  constructor(initialState: any) {
    this.state = initialState;
  }

  async get(id: string): Promise<any> {
    return this.state;
  }

  async set(id: string, state: any): Promise<void> {
    this.state = state;
  }

  async remove(id: string): Promise<void> {
    this.state = null;
  }

  async setContractAddress(address: string): Promise<void> {}

  async getSigningKey(address: any): Promise<any> {
    return this.signingKey;
  }

  async setSigningKey(address: any, key: any): Promise<void> {
    this.signingKey = key;
  }

  async removeSigningKey(address: any): Promise<void> {
    this.signingKey = null;
  }

  async clear(): Promise<void> {
    this.state = null;
    this.signingKey = null;
  }
}

// --- PROVIDER BUILDER ---

export interface CreatorIdentity {
  version: number;
  contractAddress: string;
  ownerPublicKey: string;
  secretKey: number[];
  createdAt: string;
}

export async function buildAppProviders(
  wallet?: ConnectedAPI,
  creatorIdentity?: CreatorIdentity | null,
): Promise<{
  providers: MidnightProviders<any>;
  stateProvider?: MemoryPrivateStateProvider;
}> {
  function createPrivateState(creatorIdentity: CreatorIdentity) {
    return createQuoteOTDPrivateState(
      new Uint8Array(creatorIdentity.secretKey),
    );
  }

  const privateStateProvider =
    creatorIdentity &&
    new MemoryPrivateStateProvider(createPrivateState(creatorIdentity));
  const inMemoryBBoardPrivateStateProvider = inMemoryPrivateStateProvider<
    string,
    QuoteOTDPrivateState
  >();
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
      privateStateProvider: creatorIdentity
        ? (privateStateProvider as any)
        : inMemoryBBoardPrivateStateProvider,
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

export async function joinQuoteOfTheDayContract(
  providers: MidnightProviders<any>,
  contractAddress: string,
  creatorIdentity: CreatorIdentity | null,
) {
  // Create an initial state wrapper just for the join
  const initialPrivateState = creatorIdentity
    ? createQuoteOTDPrivateState(new Uint8Array(creatorIdentity.secretKey))
    : createQuoteOTDPrivateState(new Uint8Array(32));

  const deployedQOTDContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledQuoteOfTheDayContract,
    privateStateId: "OwnerPrivateQuoteOTDState",
    initialPrivateState,
  });

  return deployedQOTDContract;
}
