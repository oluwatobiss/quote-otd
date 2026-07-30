import { type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { FetchZkConfigProvider } from "./fetchZkConfigProvider";
import { getConfig } from "./config";
import { createQuoteOTDPrivateState } from "./witnesses";

export type QuoteOfTheDayCircuits = "post" | "publicKey";
import type {
  WalletProvider,
  MidnightProvider,
  PrivateStateProvider,
} from "@midnight-ntwrk/midnight-js-types";
import type { WalletConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

// --- DAPP CONNECTOR WRAPPER ---

export class DAppConnectorWrapper implements WalletProvider, MidnightProvider {
  constructor(private api: WalletConnectedAPI) {}

  async balanceTx(tx: any, ttl?: Date): Promise<any> {
    let hexTx: string;
    if (tx && typeof tx.serialize === "function") {
      hexTx = Buffer.from(tx.serialize()).toString("hex");
    } else {
      hexTx = Buffer.from(tx).toString("hex");
    }
    const balanced = await this.api.balanceUnsealedTransaction(hexTx);

    // In Midnight.js v4, the pipeline might expect a Transaction object.
    // If it fails because it's not a Transaction object, we'll need to parse it.
    // Let's try returning an object with serialize() just in case!
    const balancedBytes = Buffer.from(balanced.tx, "hex");
    return {
      serialize: () => balancedBytes,
      ...balancedBytes,
    };
  }

  async submitTx(tx: any): Promise<string> {
    let hexTx: string;
    if (tx && typeof tx.serialize === "function") {
      hexTx = Buffer.from(tx.serialize()).toString("hex");
    } else {
      hexTx = Buffer.from(tx).toString("hex");
    }
    await this.api.submitTransaction(hexTx);
    return "submitted";
  }

  // The interface defines getCoinPublicKey and getEncryptionPublicKey as returning values synchronously?
  // No, in some versions of midnight-js, WalletProvider methods might be async or sync.
  // Actually, wait! The interface says `getCoinPublicKey(): CoinPublicKey` which is sync!
  // But DApp API `getShieldedAddresses()` is async. We must cache them on connect.
  private cachedCoinPublicKey!: string;
  private cachedEncPublicKey!: string;

  async init() {
    const addresses = await this.api.getShieldedAddresses();
    this.cachedCoinPublicKey = addresses.shieldedCoinPublicKey;
    this.cachedEncPublicKey = addresses.shieldedEncryptionPublicKey;
  }

  getCoinPublicKey(): string {
    return this.cachedCoinPublicKey;
  }

  getEncryptionPublicKey(): string {
    return this.cachedEncPublicKey;
  }
}

export async function connectBrowserWallet(): Promise<DAppConnectorWrapper> {
  // @ts-ignore
  if (typeof window === "undefined" || !window.midnight?.mnLace) {
    throw new Error(
      "Lace wallet extension not found. Please install Lace and try again.",
    );
  }
  // @ts-ignore
  const api: WalletConnectedAPI = await window.midnight.mnLace.enable();
  const wrapper = new DAppConnectorWrapper(api);
  await wrapper.init();
  return wrapper;
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
  wallet: DAppConnectorWrapper,
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
