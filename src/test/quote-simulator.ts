import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../../contracts/managed/quote-otd/contract/index.js";
import { type QuotePrivateState, witnesses } from "../../utils/witnesses.js";

export class QuoteSimulator {
  readonly contract: Contract<QuotePrivateState>;
  circuitContext: CircuitContext<QuotePrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<QuotePrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey }, "0".repeat(64)),
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  // Switch to a different secret key for a different user
  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = {
      secretKey,
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): QuotePrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public post(newQuote: string): Ledger {
    // Update the current context to be the result of executing the circuit.
    this.circuitContext = this.contract.impureCircuits.post(
      this.circuitContext,
      newQuote,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public publicKey(): Uint8Array {
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
    ).result;
  }
}
