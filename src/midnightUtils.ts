import type {
  PrivateStateProvider,
  MidnightProviders,
} from "@midnight-ntwrk/midnight-js-types";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { getConfig } from "./config";
import { FetchZkConfigProvider } from "./fetchZkConfigProvider";
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

  // Optional: Check if the connection is established
  const connectionStatus = await connectedApi.getConnectionStatus();
  if (connectionStatus.status === "connected") {
    // Retrieve the unshielded address from the wallet
    const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
    const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
      await connectedApi.getShieldedAddresses();

    // The Midnight JS SDK expects synchronous getCoinPublicKey methods on the WalletProvider.
    // The DApp connector provides them asynchronously, so we polyfill them here.
    (connectedApi as any).getCoinPublicKey = () => shieldedCoinPublicKey;
    (connectedApi as any).getEncryptionPublicKey = () =>
      shieldedEncryptionPublicKey;

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
  wallet: ConnectedAPI,
  creatorIdentity: CreatorIdentity | null,
): Promise<{
  providers: MidnightProviders<any>;
  stateProvider: MemoryPrivateStateProvider;
}> {
  const walletConfig = await wallet.getConfiguration();
  const zkConfigProvider = new FetchZkConfigProvider<QuoteOfTheDayCircuits>();

  // Ephemeral memory state!
  // If we have an identity, use it. Otherwise, use dummy.
  const privateState = creatorIdentity
    ? createQuoteOTDPrivateState(new Uint8Array(creatorIdentity.secretKey))
    : createQuoteOTDPrivateState(new Uint8Array(32));

  const privateStateProvider = new MemoryPrivateStateProvider(privateState);

  return {
    providers: {
      privateStateProvider: privateStateProvider as any,
      publicDataProvider: indexerPublicDataProvider(
        walletConfig.indexerUri,
        walletConfig.indexerWsUri,
      ),
      zkConfigProvider: zkConfigProvider as any,
      proofProvider: httpClientProofProvider(
        walletConfig.proverServerUri || "http://127.0.0.1:6300",
        zkConfigProvider as any,
      ),
      walletProvider: wallet as any,
      midnightProvider: wallet as any,
    },
    stateProvider: privateStateProvider,
  };
}

export function buildReadonlyProviders(): MidnightProviders {
  const config = getConfig();
  setNetworkId(config.networkId);
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

  return {
    privateStateProvider: inMemoryBBoardPrivateStateProvider,
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),
    zkConfigProvider: new FetchZkConfigProvider<QuoteOfTheDayCircuits>() as any,
    proofProvider: httpClientProofProvider(
      config.proofServer,
      new FetchZkConfigProvider<QuoteOfTheDayCircuits>() as any,
    ),
    walletProvider: dummyWallet as any,
    midnightProvider: dummyWallet as any,
  } as any;
}

export class MidnightProvingClient {
  constructor(
    private contract: any,
    private stateProvider: MemoryPrivateStateProvider,
  ) {}

  async provePost(newQuote: string): Promise<string> {
    const tx = await this.contract.callTx.post(newQuote);
    // After provePost succeeds, the private state must be wiped.
    await this.stateProvider.clear();
    return tx.txHash || "unknown_hash";
  }
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
