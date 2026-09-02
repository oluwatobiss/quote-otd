import { type ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { type FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { type Logger } from "pino";
import { type Observable, combineLatest, map, from } from "rxjs";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { Contract } from "../contracts/index";
import * as Quote from "../contracts/managed/quote-otd/contract/index.js";
import { PRIVATE_STATE_ID } from "../utils/config.js";
import { type QuotePrivateState } from "../utils/witnesses.js";

export type PrivateStateId = typeof PRIVATE_STATE_ID;

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
  PrivateStateId,
  QuotePrivateState
>;
type DeployedQuoteContract = FoundContract<QuoteContract>;

/**
 * A type that represents the derived combination of public (or ledger), and private state.
 */
type QuoteDerivedState = {
  readonly quoteOfTheDay: string;
  readonly isOwner: boolean;
};

export interface DeployedQuoteService {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<QuoteDerivedState>;
  publish: (newQuote: string) => Promise<string>;
}

export class QuoteOTDClient implements DeployedQuoteService {
  static async build(
    deployedContract: DeployedQuoteContract,
    providers: QuoteProviders,
    logger?: Logger,
  ): Promise<QuoteOTDClient> {
    return new QuoteOTDClient(deployedContract, providers, logger);
  }

  private constructor(
    public readonly deployedContract: DeployedQuoteContract,
    providers: QuoteProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress =
      deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(
      this.deployedContractAddress,
    );
    this.state$ = combineLatest(
      [
        // Combine public (ledger) state with...
        providers.publicDataProvider
          .contractStateObservable(this.deployedContractAddress, {
            type: "latest",
          })
          .pipe(map((contractState) => Quote.ledger(contractState.data))),
        // ...private state...
        from(
          providers.privateStateProvider.get(
            PRIVATE_STATE_ID,
          ) as Promise<QuotePrivateState>,
        ),
      ],
      // ...and combine them to produce the required derived state.
      (ledgerState, privateState) => {
        const hashedSecretKey = Quote.pureCircuits.publicKey(
          privateState.secretKey,
        );

        return {
          quoteOfTheDay: ledgerState.quoteOfTheDay,
          isOwner: toHex(ledgerState.owner) === toHex(hashedSecretKey),
        };
      },
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<QuoteDerivedState>;
  async publish(newQuote: string): Promise<string> {
    this.logger?.info(`postingMessage: ${newQuote}`);

    const txData = await this.deployedContract.callTx.post(newQuote);

    this.logger?.trace({
      transactionAdded: {
        circuit: "post",
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return txData.public.txHash;
  }
}
