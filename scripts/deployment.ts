import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { network } from "../utils/config";
import {
  generateSecretKey,
  buildCreatorIdentity,
  parseCreatorIdentity,
  serializeCreatorIdentity,
} from "../utils/creatorIdentity.js";
import { type CreatorIdentity } from "../utils/quote.types.js";

const MIDNIGHT_DIR = resolve(process.cwd(), ".midnight");
const DEPLOYMENT_FILE = resolve(MIDNIGHT_DIR, `creator-id.${network}.quoteotd`);

export interface DeploymentInfo {
  secretKey: Uint8Array;
  contractAddress?: string;
  network: string;
}

export function saveDeploymentInfo(
  data: DeploymentInfo | CreatorIdentity,
): void {
  // Overload to support saving either intermediate DeploymentInfo or full CreatorIdentity
  let creatorId: CreatorIdentity;

  if ("version" in data) {
    creatorId = data as CreatorIdentity;
  } else {
    creatorId = buildCreatorIdentity(
      data.contractAddress || "unknown",
      data.network,
      data.secretKey,
    );
  }

  writeFileSync(DEPLOYMENT_FILE, serializeCreatorIdentity(creatorId), "utf8");
}

export function getDeploymentInfo(network: string): DeploymentInfo {
  if (existsSync(DEPLOYMENT_FILE)) {
    const rawString = readFileSync(DEPLOYMENT_FILE, "utf8");
    const creatorId = parseCreatorIdentity(rawString);

    return {
      secretKey: new Uint8Array(creatorId.secretKey),
      contractAddress: creatorId.contractAddress,
      network: creatorId.network,
    };
  }

  mkdirSync(dirname(DEPLOYMENT_FILE), { recursive: true });

  const deploymentInfo: DeploymentInfo = {
    secretKey: generateSecretKey(),
    network,
  };

  saveDeploymentInfo(deploymentInfo);
  return deploymentInfo;
}
