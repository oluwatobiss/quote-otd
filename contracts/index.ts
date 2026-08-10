import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { Contract } from "./managed/quote-otd/contract/index.js";
import { witnesses } from "../utils/witnesses.js";

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
} from "./managed/quote-otd/contract/index.js";

export const CompiledQuoteContract = CompiledContract.make(
  "QuoteOfTheDayContract",
  Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./managed/quote-otd"),
);
