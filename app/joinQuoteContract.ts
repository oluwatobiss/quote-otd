import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { CompiledQuoteContract, Contract } from "../contracts/index";
import * as Quote from "../contracts/managed/quote-otd/contract/index";
import { PRIVATE_STATE_ID } from "../utils/config.js";
import type { CreatorIdentity } from "../utils/quote.types";
import {
  createQuotePrivateState,
  type QuotePrivateState,
} from "../utils/witnesses";

type QuoteContract = Contract<
  QuotePrivateState,
  Quote.Witnesses<QuotePrivateState>
>;
type BBoardCircuitKeys = Exclude<
  keyof QuoteContract["impureCircuits"],
  number | symbol
>;
type QuoteProviders = MidnightProviders<
  BBoardCircuitKeys,
  typeof PRIVATE_STATE_ID,
  QuotePrivateState
>;

// --- PROVIDER BUILDER ---
export async function joinQuoteContract(
  providers: QuoteProviders,
  contractAddress: string,
  creatorId: CreatorIdentity | null,
) {
  // Create an initial state wrapper just for the join
  const initialPrivateState = creatorId
    ? createQuotePrivateState(new Uint8Array(creatorId.secretKey))
    : createQuotePrivateState(new Uint8Array(32));

  const deployedContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledQuoteContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState,
  });

  return deployedContract;
}
