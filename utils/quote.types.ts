export interface CreatorIdentity {
  version: number;
  contractAddress: string;
  network: string;
  ownerPublicKey: string;
  secretKey: number[];
  createdAt: string;
}

export type QuoteOfTheDayCircuits = "post" | "publicKey";

export type WalletSecret =
  | { kind: "seed"; value: string }
  | { kind: "mnemonic"; value: string };
