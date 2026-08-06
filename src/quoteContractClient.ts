import * as QuoteOTD from "../contracts/managed/quote-otd/contract/index.js";
import { type ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { type FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { type Logger } from "pino";
import { type QuoteOTDPrivateState } from "./witnesses.js";
import { type Observable, combineLatest, map, from } from "rxjs";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { Contract } from "../contracts/index";

export const quoteOTDPrivateStateKey = "OwnerPrivateQuoteOTDState";
export type PrivateStateId = typeof quoteOTDPrivateStateKey;

type QuoteOTDContract = Contract<
  QuoteOTDPrivateState,
  QuoteOTD.Witnesses<QuoteOTDPrivateState>
>;
type BBoardCircuitKeys = Exclude<
  keyof QuoteOTDContract["impureCircuits"],
  number | symbol
>;
type QuoteOTDProviders = MidnightProviders<
  BBoardCircuitKeys,
  PrivateStateId,
  QuoteOTDPrivateState
>;
type DeployedQuoteOTDContract = FoundContract<QuoteOTDContract>;

/**
 * A type that represents the derived combination of public (or ledger), and private state.
 */
type QuoteOTDDerivedState = {
  readonly quoteOfTheDay: string;
  readonly isOwner: boolean;
};

export interface DeployedQuoteService {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<QuoteOTDDerivedState>;
  publish: (newQuote: string) => Promise<string>;
}

export class QuoteContractClient implements DeployedQuoteService {
  static async build(
    deployedContract: DeployedQuoteOTDContract,
    providers: QuoteOTDProviders,
    logger?: Logger,
  ): Promise<QuoteContractClient> {
    return new QuoteContractClient(deployedContract, providers, logger);
  }

  private constructor(
    public readonly deployedContract: DeployedQuoteOTDContract,
    providers: QuoteOTDProviders,
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
          .pipe(map((contractState) => QuoteOTD.ledger(contractState.data))),
        // ...private state...
        from(
          providers.privateStateProvider.get(
            quoteOTDPrivateStateKey,
          ) as Promise<QuoteOTDPrivateState>,
        ),
      ],
      // ...and combine them to produce the required derived state.
      (ledgerState, privateState) => {
        const hashedSecretKey = QuoteOTD.pureCircuits.publicKey(
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
  readonly state$: Observable<QuoteOTDDerivedState>;
  async publish(newQuote: string): Promise<string> {
    this.logger?.info(`postingMessage: ${newQuote}`);

    const txData = await this.deployedContract.callTx.post(newQuote);

    console.log("=== publish: quoteContractClient.ts ===");
    console.log({
      transactionAdded: {
        circuit: "post",
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

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
