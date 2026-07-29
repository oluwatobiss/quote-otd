import {
  deployContract,
  type DeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";

import {
  PRIVATE_STATE_ID,
  ensureDeploymentInfo,
  ownerSecret,
  saveDeploymentInfo,
} from "./deployment.js";

import { createQuoteOTDPrivateState } from "../src/witnesses.js";

import {
  type EnvironmentConfiguration,
  waitForFunds,
} from "@midnight-ntwrk/testkit-js";
import pino from "pino";
import { getConfig } from "../src/config.js";
import {
  MidnightWalletProvider,
  syncWallet,
  type WalletSecret,
} from "../src/wallet.js";

import {
  buildProviders,
  type QuoteOfTheDayProviders,
} from "../src/providers.js";

import {
  CompiledQuoteOfTheDayContract,
  Contract,
  zkConfigPath,
} from "../contracts/index.js";

async function main() {
  let wallet: MidnightWalletProvider;
  let providers: QuoteOfTheDayProviders;

  const OWNER_LOCAL_SEED =
    "0000000000000000000000000000000000000000000000000000000000000001";
  const logger = pino({
    level: process.env["LOG_LEVEL"] ?? "info",
    transport: { target: "pino-pretty" },
  });
  const network = process.env.MIDNIGHT_NETWORK ?? "local";

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

  const deploymentInfo = ensureDeploymentInfo(network);
  const config = getConfig();
  const secret = resolveSecret(network);
  const isRemote = network !== "local";
  const syncTimeoutMs = Number(
    process.env["MIDNIGHT_SYNC_TIMEOUT_MS"] ??
      (isRemote ? 60 * 60_000 : 10 * 60_000),
  );

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

  logger.info("Deploying Quote of the Day contract...");
  logger.info(`Network: ${network}`);

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

  providers = buildProviders(wallet, zkConfigPath, config);

  const deployed: DeployedContract<Contract> = await deployContract<Contract>(
    providers,
    {
      compiledContract: CompiledQuoteOfTheDayContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createQuoteOTDPrivateState(
        ownerSecret(deploymentInfo),
      ),
    },
  );

  logger.info("✅ Contract deployed successfully!");

  deploymentInfo.contractAddress = deployed.deployTxData.public.contractAddress;
  saveDeploymentInfo(deploymentInfo);

  logger.info(`Contract Address: ${deploymentInfo.contractAddress}`);
  logger.info(`Saved to: .midnight/deployment.json`);
  logger.info(
    "─── Deployment Complete! ───────────────────────────────────────",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
