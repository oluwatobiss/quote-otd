import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "../utils/crypto.js";

const MIDNIGHT_DIR = resolve(process.cwd(), ".midnight");
const DEPLOYMENT_FILE = resolve(MIDNIGHT_DIR, "creator-id.quoteotd");

export interface DeploymentInfo {
  secretKey: Uint8Array<ArrayBufferLike>;
  contractAddress?: string;
  network: string;
}

export function saveDeploymentInfo(data: DeploymentInfo): void {
  const creatorId = {
    ...data,
    secretKey: Array.from(data.secretKey),
  };
  writeFileSync(DEPLOYMENT_FILE, JSON.stringify(creatorId, null, 2), "utf8");
}

export function getDeploymentInfo(network: string): DeploymentInfo {
  if (existsSync(DEPLOYMENT_FILE)) {
    const data = JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8")) as any;
    if (data.secretKey) {
      if (Array.isArray(data.secretKey)) {
        data.secretKey = new Uint8Array(data.secretKey);
      } else if (typeof data.secretKey === "object") {
        data.secretKey = new Uint8Array(Object.values(data.secretKey));
      }
    }
    return data as DeploymentInfo;
  }

  mkdirSync(dirname(DEPLOYMENT_FILE), { recursive: true });

  const deploymentInfo: DeploymentInfo = {
    secretKey: randomBytes(32),
    network,
  };

  saveDeploymentInfo(deploymentInfo);
  return deploymentInfo;
}
