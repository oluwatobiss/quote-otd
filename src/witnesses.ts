import { type Ledger } from "../contracts/managed/quote-otd/contract/index.js";
import { type WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type QuoteOTDPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createQuoteOTDPrivateState = (secretKey: Uint8Array) => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, QuoteOTDPrivateState>): [
    QuoteOTDPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
