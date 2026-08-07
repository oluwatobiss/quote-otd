import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { CompiledQuoteContract } from "../contracts/index";
import { PRIVATE_STATE_ID } from "../utils/config.js";
import type { CreatorIdentity } from "../utils/quote.types";
import { createQuotePrivateState } from "../utils/witnesses";

// --- PROVIDER BUILDER ---
export async function joinQuoteContract(
  providers: MidnightProviders<any>,
  contractAddress: string,
  creatorIdentity: CreatorIdentity | null,
) {
  // Create an initial state wrapper just for the join
  const initialPrivateState = creatorIdentity
    ? createQuotePrivateState(new Uint8Array(creatorIdentity.secretKey))
    : createQuotePrivateState(new Uint8Array(32));

  const deployedContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledQuoteContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState,
  });

  return deployedContract;
}
