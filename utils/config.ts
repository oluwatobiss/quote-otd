export type NetworkConfig = {
  networkId: string;
  indexer: string;
  indexerWS: string;
  node: string;
  nodeWS: string;
  proofServer: string;
  // Human-facing faucet page for topping up test wallets. Not a programmatic
  // drip endpoint — the tests assume seeds in .env.<network> are pre-funded.
  faucet: string;
};

export const LOCAL_CONFIG: NetworkConfig = {
  networkId: "undeployed",
  indexer: "http://127.0.0.1:8088/api/v4/graphql",
  indexerWS: "ws://127.0.0.1:8088/api/v4/graphql/ws",
  node: "http://127.0.0.1:9944",
  nodeWS: "ws://127.0.0.1:9944",
  proofServer: "http://127.0.0.1:6300",
  faucet: "",
};

export const network = process.env["MIDNIGHT_NETWORK"] ?? "local";
export const OWNER_LOCAL_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

export const PREVIEW_CONFIG: NetworkConfig = {
  networkId: "preview",
  indexer: "https://indexer.preview.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preview.midnight.network",
  nodeWS: "wss://rpc.preview.midnight.network",
  proofServer: process.env["MIDNIGHT_PROOF_SERVER"] ?? "http://127.0.0.1:6300",
  faucet: "https://midnight-tmnight-preview.nethermind.dev/",
};

export const PREPROD_CONFIG: NetworkConfig = {
  networkId: "preprod",
  indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preprod.midnight.network",
  nodeWS: "wss://rpc.preprod.midnight.network",
  proofServer: process.env["MIDNIGHT_PROOF_SERVER"] ?? "http://127.0.0.1:6300",
  faucet: "https://midnight-tmnight-preprod.nethermind.dev/",
};

export const PRIVATE_STATE_ID = "OwnerPrivateQuoteState";

export function getConfig(): NetworkConfig {
  // Check import.meta.env first: Vite statically replaces these at build/dev
  // time, making them the authoritative source in the browser. The process.env
  // stub Vite provides is always truthy but carries no runtime values, so
  // checking it first causes the network to always fall back to the default.
  let resolvedNetwork = "local";
  if (
    typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_MIDNIGHT_NETWORK
  ) {
    resolvedNetwork = (import.meta as any).env.VITE_MIDNIGHT_NETWORK;
  } else if (typeof process !== "undefined" && process.env?.MIDNIGHT_NETWORK) {
    resolvedNetwork = process.env.MIDNIGHT_NETWORK;
  }

  if (resolvedNetwork === "local") return LOCAL_CONFIG;
  if (resolvedNetwork === "preview") return PREVIEW_CONFIG;
  if (resolvedNetwork === "preprod") return PREPROD_CONFIG;

  throw new Error(
    `Unknown network: ${resolvedNetwork}. Supported: 'local', 'preview', 'preprod'.`,
  );
}
