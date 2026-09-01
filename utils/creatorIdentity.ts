import { randomBytes } from "./crypto.js";
import type { CreatorIdentity } from "./quote.types.js";

export function generateSecretKey(): Uint8Array {
  return randomBytes(32);
}

export function buildCreatorIdentity(
  contractAddress: string,
  network: string,
  secretKey: Uint8Array,
): CreatorIdentity {
  return {
    version: 1,
    contractAddress,
    network,
    ownerPublicKey: "unknown",
    secretKey: Array.from(secretKey),
    createdAt: new Date().toISOString(),
  };
}

export function parseCreatorIdentity(jsonString: string): CreatorIdentity {
  const data = JSON.parse(jsonString) as CreatorIdentity;
  if (data.secretKey) {
    if (typeof data.secretKey === "object" && !Array.isArray(data.secretKey)) {
      data.secretKey = Array.from(Object.values(data.secretKey));
    }
  }
  return data;
}

export function serializeCreatorIdentity(identity: CreatorIdentity): string {
  return JSON.stringify(identity, null, 2);
}
