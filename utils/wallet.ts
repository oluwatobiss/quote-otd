import * as Rx from "rxjs";
import { getConfig } from "./config";
import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import { Transaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { toHex, fromHex } from "@midnight-ntwrk/midnight-js-utils";
import type { WalletFacade, FacadeState } from "@midnight-ntwrk/wallet-sdk";
import type { Logger } from "pino";

export function listWallets(): InitialAPI[] {
  // @ts-ignore
  const injected = window.midnight;
  return injected ? Object.values(injected) : [];
}

export function selectWallet(): InitialAPI {
  const wallets = listWallets();
  if (wallets.length === 0) {
    throw new Error(
      "No Midnight wallet found. Please install a Midnight wallet extension.",
    );
  }
  return wallets[0];
}

export async function connectBrowserWallet(
  wallet: InitialAPI,
): Promise<ConnectedAPI> {
  console.log("Connect button clicked");

  // Connect to the configured network
  const config = getConfig();
  const connectedApi = await wallet.connect(config.networkId);

  const connectionStatus = await connectedApi.getConnectionStatus();
  if (connectionStatus.status === "connected") {
    // Hint usage to prompt the user for permissions
    try {
      await connectedApi.hintUsage([
        "balanceUnsealedTransaction",
        "balanceSealedTransaction",
        "submitTransaction",
        "getShieldedAddresses",
        "getUnshieldedAddress",
      ]);
    } catch (e) {
      console.warn("hintUsage failed or not supported by wallet", e);
    }

    // Retrieve the unshielded address from the wallet
    const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
    const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
      await connectedApi.getShieldedAddresses();

    // The Midnight JS SDK expects synchronous getCoinPublicKey methods on the WalletProvider.
    // The DApp connector provides them asynchronously, so we polyfill them here.
    (connectedApi as any).getCoinPublicKey = () => shieldedCoinPublicKey;
    (connectedApi as any).getEncryptionPublicKey = () =>
      shieldedEncryptionPublicKey;

    // Polyfill WalletProvider methods
    (connectedApi as any).balanceTx = async (tx: any, newCoins: any) => {
      const txStr = toHex(tx.serialize());
      const balanced = await connectedApi.balanceUnsealedTransaction(txStr);
      return Transaction.deserialize(
        "signature",
        "proof",
        "binding",
        fromHex(balanced.tx),
      );
    };
    (connectedApi as any).submitTx = async (tx: any) => {
      const txStr = toHex(tx.serialize());
      const walletHash = (await connectedApi.submitTransaction(txStr)) as any;
      if (typeof walletHash === "string" && walletHash.trim() !== "") {
        return walletHash;
      }
      if (walletHash && typeof walletHash === "object") {
        if (typeof walletHash.txHash === "string") return walletHash.txHash;
        if (typeof walletHash.hash === "string") return walletHash.hash;
      }
      const hash = tx.identifiers()[0];
      return typeof hash === "string" ? hash : toHex(hash);
    };

    console.log({
      isConnected: true,
      walletAddress: unshieldedAddress,
    });
  }

  return connectedApi;
}

function isProgressStrictlyComplete(progress: unknown): boolean {
  if (!progress || typeof progress !== "object") {
    return false;
  }
  const candidate = progress as { isStrictlyComplete?: unknown };
  if (typeof candidate.isStrictlyComplete !== "function") {
    return false;
  }
  return (candidate.isStrictlyComplete as () => boolean)();
}

export async function syncWallet(
  logger: Logger,
  wallet: WalletFacade,
  timeout = 300_000,
): Promise<FacadeState> {
  logger.info("Syncing wallet...");
  let emissionCount = 0;
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.tap((state: FacadeState) => {
        emissionCount++;
        const shielded = isProgressStrictlyComplete(
          state.shielded.state.progress,
        );
        const unshielded = isProgressStrictlyComplete(
          state.unshielded.progress,
        );
        const dust = isProgressStrictlyComplete(state.dust.state.progress);
        logger.info(
          `Wallet sync [${emissionCount}]: shielded=${shielded}, unshielded=${unshielded}, dust=${dust}`,
        );
        if (!shielded) {
          logger.debug(
            `  shielded.progress: ${JSON.stringify(state.shielded.state.progress)}`,
          );
        }
        if (!unshielded) {
          logger.debug(
            `  unshielded.progress: ${JSON.stringify(state.unshielded.progress)}`,
          );
        }
        if (!dust) {
          logger.debug(
            `  dust.progress: ${JSON.stringify(state.dust.state.progress)}`,
          );
        }
      }),
      Rx.filter(
        (state: FacadeState) =>
          isProgressStrictlyComplete(state.shielded.state.progress) &&
          isProgressStrictlyComplete(state.dust.state.progress) &&
          isProgressStrictlyComplete(state.unshielded.progress),
      ),
      Rx.tap(() =>
        logger.info(`Wallet sync complete after ${emissionCount} emissions`),
      ),
      Rx.timeout({
        each: timeout,
        with: () =>
          Rx.throwError(
            () =>
              new Error(
                `Wallet sync timeout after ${timeout}ms (${emissionCount} emissions received)`,
              ),
          ),
      }),
      Rx.catchError((err) => {
        logger.error(`Wallet sync error: ${err}`);
        return Rx.throwError(() => err);
      }),
    ),
  );
}
