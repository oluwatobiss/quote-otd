import { type Ledger } from "../contracts/managed/quote-otd/contract/index.js";
import { type WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type QuotePrivateState = {
  readonly secretKey: Uint8Array;
};

export const createQuotePrivateState = (secretKey: Uint8Array) => ({
  secretKey,
});

export const witnesses = {
  creatorIdentity: ({
    privateState,
  }: WitnessContext<Ledger, QuotePrivateState>): [
    QuotePrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
