import pino from "pino";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import {
  deployContract,
  submitCallTx,
  type DeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import {
  type EnvironmentConfiguration,
  waitForFunds,
} from "@midnight-ntwrk/testkit-js";
import { QuoteSimulator } from "./quote-simulator.js";
import { syncWallet } from "../../utils/wallet.js";
import {
  CompiledQuoteContract,
  Contract,
  ledger,
} from "../../contracts/index.js";
import { MidnightWalletProvider } from "../../providers/walletProviders.js";
import {
  buildProviders,
  type QuoteOfTheDayProviders,
} from "../../providers/buildProviders.js";
import type { WalletSecret } from "../../utils/quote.types.js";
import {
  getConfig,
  OWNER_LOCAL_SEED,
  PRIVATE_STATE_ID,
} from "../../utils/config.js";
import { randomBytes } from "../../utils/crypto.js";
import { createQuotePrivateState } from "../../utils/witnesses.js";

// Required for GraphQL subscriptions in Node.js
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
  console.error("Promise:", promise);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport: { target: "pino-pretty" },
});

const network = process.env["MIDNIGHT_NETWORK"] ?? "local";

function resolveSecret(net: string): WalletSecret {
  if (net === "local") return { kind: "seed", value: OWNER_LOCAL_SEED };

  const upper = net.toUpperCase();
  const mnemonicEnv = `MIDNIGHT_${upper}_MNEMONIC`;
  const seedEnv = `MIDNIGHT_${upper}_SEED`;
  const mnemonic = process.env[mnemonicEnv]?.trim().replace(/\s+/g, " ");
  const seedHex = process.env[seedEnv]?.trim();

  if (mnemonic && seedHex) {
    throw new Error(
      `Set only one of ${mnemonicEnv} or ${seedEnv} (both are defined).`,
    );
  }
  if (mnemonic) {
    return { kind: "mnemonic", value: mnemonic };
  }
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

describe(`Quote of The Day Contract (${network})`, () => {
  let wallet: MidnightWalletProvider;
  let providers: QuoteOfTheDayProviders;
  let contractAddress: ContractAddress;

  const config = getConfig();
  const secret = resolveSecret(network);
  const isRemote = network !== "local";
  const syncTimeoutMs = Number(
    process.env["MIDNIGHT_SYNC_TIMEOUT_MS"] ??
      (isRemote ? 60 * 60_000 : 10 * 60_000),
  );

  async function queryLedger(p: QuoteOfTheDayProviders) {
    const state =
      await p.publicDataProvider.queryContractState(contractAddress);
    expect(state).not.toBeNull();
    return ledger(state!.data);
  }

  beforeAll(async () => {
    setNetworkId(config.networkId);

    const envConfig: EnvironmentConfiguration = {
      walletNetworkId: config.networkId,
      networkId: config.networkId,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      faucet: config.faucet,
      proofServer: config.proofServer,
    };

    wallet = await MidnightWalletProvider.build(logger, envConfig, secret);
    await wallet.start();
    await syncWallet(logger, wallet.wallet, syncTimeoutMs);

    if (isRemote) {
      // NIGHT→DUST registration. Seed is pre-funded via the faucet page; idempotent.
      const nightBalance = await waitForFunds(
        wallet.wallet,
        envConfig,
        false,
        wallet.unshieldedKeystore,
      );
      logger.info(`Wallet NIGHT balance on '${network}': ${nightBalance}`);
    }

    providers = buildProviders(wallet, "contracts/managed/quote-otd", config);
    logger.info(`Providers initialized on '${network}'. Ready to test!`);
  });

  afterAll(async () => {
    if (wallet) {
      logger.info("Stopping wallet...");
      await wallet.stop();
    }
  });

  it("deploys the contract", async () => {
    logger.info(`Creating private state...`);

    const deployed: DeployedContract<Contract> = await deployContract<Contract>(
      providers,
      {
        compiledContract: CompiledQuoteContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createQuotePrivateState(randomBytes(32)),
      },
    );

    logger.info(`Setting the contract address...`);
    contractAddress = deployed.deployTxData.public.contractAddress;
    logger.info(`Contract deployed at: ${contractAddress}`);

    expect(contractAddress).toBeDefined();
    expect(contractAddress.length).toBeGreaterThan(0);

    const ledgerState = await queryLedger(providers);
    expect(ledgerState.quoteOfTheDay).toEqual("");
  });

  it("generates initial ledger state deterministically", () => {
    const ownerSecretKey = randomBytes(32);
    const simulator0 = new QuoteSimulator(ownerSecretKey);
    const simulator1 = new QuoteSimulator(ownerSecretKey);
    expect(simulator0.getLedger()).toEqual(simulator1.getLedger());
  });

  it("properly initializes ledger state and private state", () => {
    const ownerSecretKey = randomBytes(32);
    const simulator = new QuoteSimulator(ownerSecretKey);
    const initialLedgerState = simulator.getLedger();
    const initialPublicKey = simulator.publicKey();
    const initialPrivateState = simulator.getPrivateState();
    expect(initialLedgerState.owner).toEqual(initialPublicKey);
    expect(initialLedgerState.quoteOfTheDay).toEqual("");
    expect(initialPrivateState).toEqual({ secretKey: ownerSecretKey });
  });

  it("lets the owner post via the Midnight network SDK", async () => {
    const quote =
      "A quitter never wins—and—a winner never quits. — Napoleon Hill";
    await submitCallTx<Contract, "post">(providers, {
      compiledContract: CompiledQuoteContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: "post",
      args: [quote],
    });
    const ledgerState = await queryLedger(providers);
    expect(ledgerState.quoteOfTheDay).toEqual(quote);
  });

  it("lets the owner post in the local Compact simulator", () => {
    const quote =
      "A quitter never wins—and—a winner never quits. — Napoleon Hill";
    const simulator = new QuoteSimulator(randomBytes(32));
    simulator.post(quote);
    const ledgerState = simulator.getLedger();
    expect(ledgerState.quoteOfTheDay).toEqual(quote);
  });

  it("lets owner post a new quote", () => {
    const simulator = new QuoteSimulator(randomBytes(32));
    const initialPublicKey = simulator.publicKey();
    const initialPrivateState = simulator.getPrivateState();
    const quote =
      "Szeth-son-son-Vallano, Truthless of Shinovar, wore white on the day he was to kill a king";
    // post a new quote
    simulator.post(quote);
    // all the correct things should have been updated in the public ledger state
    const ledgerState = simulator.getLedger();
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    expect(ledgerState.quoteOfTheDay).toEqual(quote);
    expect(ledgerState.owner).toEqual(initialPublicKey);
  });

  it("lets owner post multiple times", () => {
    const simulator = new QuoteSimulator(randomBytes(32));
    const initialPublicKey = simulator.publicKey();
    const initialPrivateState = simulator.getPrivateState();
    const quote1 =
      "Szeth-son-son-Vallano, Truthless of Shinovar, wore white on the day he was to kill a king";
    const quote2 =
      "Prince Raoden of Arelon awoke early that morning, completely unaware that he had been damned for all eternity.";
    // post first quote
    simulator.post(quote1);
    // all the correct things should have been updated in the public ledger state
    const ledgerState1 = simulator.getLedger();
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    expect(ledgerState1.quoteOfTheDay).toEqual(quote1);
    expect(ledgerState1.owner).toEqual(initialPublicKey);
    // post second quote
    simulator.post(quote2);
    // all the correct things should have been updated in the public ledger state
    const ledgerState2 = simulator.getLedger();
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    expect(ledgerState2.quoteOfTheDay).toEqual(quote2);
    expect(ledgerState2.owner).toEqual(initialPublicKey);
  });

  it("doesn't let non-owner post", () => {
    const simulator = new QuoteSimulator(randomBytes(32));
    simulator.switchUser(randomBytes(32));
    expect(() =>
      simulator.post(
        "Sometimes a hypocrite is nothing more than a man in the process of changing.",
      ),
    ).toThrow("failed assert: Attempted to post, but not the owner");
  });
});
