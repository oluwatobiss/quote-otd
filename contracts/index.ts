import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { witnesses } from "../src/witnesses.js";
import { Contract } from "./managed/quote-otd/contract/index.js";

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
} from "./managed/quote-otd/contract/index.js";

export const CompiledQuoteOfTheDayContract = CompiledContract.make(
  "QuoteOfTheDayContract",
  Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./managed/quote-otd"),
);
