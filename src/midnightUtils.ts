import { type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { FetchZkConfigProvider } from "./fetchZkConfigProvider";
import { getConfig } from "./config";
import { createQuoteOTDPrivateState } from "./witnesses";

export type QuoteOfTheDayCircuits = "post" | "publicKey";
import type { PrivateStateProvider } from "@midnight-ntwrk/midnight-js-types";
import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";

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
  const connectedApi = await wallet.connect("undeployed");
  // const connectedApi = await wallet.connect("preview");
  // const connectedApi = await wallet.connect("preprod");

  // Optional: Get the service URI configuration
  const serviceUriConfig = await connectedApi.getConfiguration();
  console.log("Service URI Config:", serviceUriConfig);

  // Optional: Check if the connection is established
  const connectionStatus = await connectedApi.getConnectionStatus();
  if (connectionStatus.status === "connected") {
    // Retrieve the unshielded address from the wallet
    const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
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

  constructor(initialState: any) {
    this.state = initialState;
  }

  async get(): Promise<any> {
    return this.state;
  }

  async set(state: any): Promise<void> {
    this.state = state;
  }

  async clear(): Promise<void> {
    this.state = null;
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
  const config = getConfig();

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
        config.indexer,
        config.indexerWS,
      ),
      zkConfigProvider: zkConfigProvider as any,
      proofProvider: httpClientProofProvider(
        config.proofServer,
        zkConfigProvider as any,
      ),
      walletProvider: wallet as any,
      midnightProvider: wallet as any,
    },
    stateProvider: privateStateProvider,
  };
}

export async function buildReadonlyProviders(): Promise<
  MidnightProviders<any>
> {
  const config = getConfig();
  const privateStateProvider = new MemoryPrivateStateProvider(
    createQuoteOTDPrivateState(new Uint8Array(32)),
  );

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
    privateStateProvider: privateStateProvider as any,
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
    const tx = await this.contract.circuits.post(newQuote);
    // After provePost succeeds, the private state must be wiped.
    await this.stateProvider.clear();
    return tx.txHash || "unknown_hash";
  }
}

import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { Contract } from "../contracts/managed/quote-otd/contract/index.js";
import { witnesses } from "./witnesses.js";

export const browserCompiledContract = CompiledContract.make(
  "QuoteOfTheDayContract",
  Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("dummy_path"),
);

export async function joinQuoteOfTheDayContract(
  providers: MidnightProviders<any>,
  contractAddress: string,
  creatorIdentity: CreatorIdentity | null,
) {
  // Create an initial state wrapper just for the join
  const initialPrivateState = creatorIdentity
    ? createQuoteOTDPrivateState(new Uint8Array(creatorIdentity.secretKey))
    : createQuoteOTDPrivateState(new Uint8Array(32));

  // @ts-ignore
  return await findDeployedContract(providers, {
    compiledContract: browserCompiledContract,
    contractAddress,
    privateStateId: "OwnerPrivateQuoteOTDState",
    initialPrivateState,
  });
}
