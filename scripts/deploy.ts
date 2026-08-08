import pino from "pino";
import { loadEnv } from "vite";
import {
  deployContract,
  type DeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import {
  waitForFunds,
  type EnvironmentConfiguration,
} from "@midnight-ntwrk/testkit-js";
import { getDeploymentInfo, saveDeploymentInfo } from "./deployment";
import { CompiledQuoteContract, Contract } from "../contracts/index";
import {
  buildProviders,
  type QuoteProviders,
} from "../providers/buildProviders";
import { MidnightWalletProvider } from "../providers/walletProviders";
import { getConfig, network, PRIVATE_STATE_ID } from "../utils/config";
import { resolveSecret } from "../utils/resolveSecret";
import { syncWallet } from "../utils/wallet";
import { createQuotePrivateState } from "../utils/witnesses";

// Load .env.<network> file into process.env before anything reads it.
// Unlike vitest, vite-node does not auto-load .env files, so we do it manually.
const isRemote = network !== "local";
if (isRemote) {
  const envFromFile = loadEnv(network, process.cwd(), "");
  for (const [key, value] of Object.entries(envFromFile)) {
    // Shell env takes priority: only set if not already defined
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  let wallet: MidnightWalletProvider;
  let providers: QuoteProviders;

  const logger = pino({
    level: process.env["LOG_LEVEL"] ?? "info",
    transport: { target: "pino-pretty" },
  });

  const config = getConfig();
  const deploymentInfo = getDeploymentInfo(network);
  const secret = resolveSecret(network);
  const syncTimeoutMs = Number(
    process.env["MIDNIGHT_SYNC_TIMEOUT_MS"] ??
      (isRemote ? 60 * 60_000 : 10 * 60_000),
  );

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

  providers = buildProviders(wallet, "contracts/managed/quote-otd", config);

  const deployed: DeployedContract<Contract> = await deployContract<Contract>(
    providers,
    {
      compiledContract: CompiledQuoteContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createQuotePrivateState(deploymentInfo.secretKey),
    },
  );

  logger.info("✅ Contract deployed successfully!");

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const ownerPublicKeyHex = "unknown";
  const creatorId = {
    version: 1,
    contractAddress,
    network,
    ownerPublicKey: ownerPublicKeyHex,
    secretKey: deploymentInfo.secretKey,
    createdAt: new Date().toISOString(),
  };

  saveDeploymentInfo(creatorId);

  logger.info(`Contract Address: ${contractAddress}`);
  logger.info(`Generated Creator Identity: .midnight/creator-id.quoteotd`);
  logger.info(
    `🚨 IMPORTANT: Store 'creator-id.quoteotd' securely! It represents ownership of your contract and is required for publishing new quotes. Do not share it with anyone. Do not commit it to version control.`,
  );
  logger.info(
    "─── Deployment Complete! ───────────────────────────────────────",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
