import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "../lib/crypto.js";

export const MIDNIGHT_DIR = resolve(process.cwd(), "midnight");
export const DEPLOYMENT_FILE = resolve(MIDNIGHT_DIR, "deployment.json");

export const PRIVATE_STATE_ID = "OwnerPrivateQuoteOTDState";

export interface DeploymentInfo {
  secretKey: Uint8Array<ArrayBufferLike>;
  contractAddress?: string;
  network: string;
}

export function ensureDeploymentInfo(network: string): DeploymentInfo {
  if (existsSync(DEPLOYMENT_FILE)) {
    return JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8")) as DeploymentInfo;
  }

  mkdirSync(dirname(DEPLOYMENT_FILE), { recursive: true });

  const deploymentInfo: DeploymentInfo = {
    secretKey: randomBytes(32),
    network,
  };

  writeFileSync(
    DEPLOYMENT_FILE,
    JSON.stringify(deploymentInfo, null, 2),
    "utf8",
  );

  return deploymentInfo;
}

export function saveDeploymentInfo(data: DeploymentInfo): void {
  writeFileSync(DEPLOYMENT_FILE, JSON.stringify(data, null, 2), "utf8");
}

export function ownerSecret(data: DeploymentInfo): Uint8Array {
  return data.secretKey;
}
