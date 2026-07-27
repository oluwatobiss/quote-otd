import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { witnesses } from "../src/witnesses.js";
import path from "node:path";

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
} from "./managed/quote-otd/contract/index.js";
import { Contract } from "./managed/quote-otd/contract/index.js";

const currentDir = path.resolve(new URL(import.meta.url).pathname, "..");
export const zkConfigPath = path.resolve(currentDir, "managed", "quote-otd");

export const CompiledQuoteOfTheDayContract = CompiledContract.make(
  "QuoteOfTheDayContract",
  Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
