import { useState, useEffect } from "react";
// @ts-ignore - allow side-effect CSS import without type declarations
import "./App.css";
import { Header } from "./components/Header";
import { WalletCard } from "./components/WalletCard";
import { CreatorIdentitySelector } from "./components/CreatorIdentitySelector";
import { OwnerCard } from "./components/OwnerCard";
import { CurrentQuoteCard } from "./components/CurrentQuoteCard";
import { PublishQuoteCard } from "./components/PublishQuoteCard";
import {
  TransactionStatusCard,
  type TxState,
} from "./components/TransactionStatusCard";
import { WalletPicker } from "./components/WalletPicker";
import { SkeletonText } from "./components/Skeleton";
import { ledger } from "../contracts/managed/quote-otd/contract/index.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import {
  buildAppProviders,
  buildReadonlyProviders,
  connectBrowserWallet,
  joinQuoteOfTheDayContract,
  MidnightProvingClient,
  listWallets,
  type CreatorIdentity,
} from "./midnightUtils";

function App() {
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [isInvalidContract, setIsInvalidContract] = useState(false);
  const [isLoadingPublicState, setIsLoadingPublicState] = useState(false);

  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Wallet Picker State
  const [isWalletPickerOpen, setIsWalletPickerOpen] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<InitialAPI[]>([]);

  const [identity, setIdentity] = useState<CreatorIdentity | null>(null);

  const [quote, setQuote] = useState<string | null>(null);
  const [ownerPublicKey, setOwnerPublicKey] = useState<string | null>(null);

  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [provingClient, setProvingClient] =
    useState<MidnightProvingClient | null>(null);

  const [sharedLinkInput, setSharedLinkInput] = useState("");

  // Parse URL for contract address on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contractParam = params.get("contract");

    if (contractParam) {
      if (contractParam.length > 10) {
        setContractAddress(contractParam);
        loadPublicState(contractParam);
      } else {
        setIsInvalidContract(true);
      }
    }
  }, []);

  // Initialize proving client when both wallet and identity are available
  useEffect(() => {
    if (wallet && identity && !provingClient) {
      const init = async () => {
        try {
          const { providers, stateProvider } = await buildAppProviders(
            wallet,
            identity,
          );
          const contract = await joinQuoteOfTheDayContract(
            providers,
            identity.contractAddress,
            identity,
          );
          setProvingClient(new MidnightProvingClient(contract, stateProvider));
        } catch (err: any) {
          console.error("Failed to initialize proving client:", err);
          setErrorMessage("Failed to initialize proving client.");
        }
      };
      init();
    }
  }, [wallet, identity, provingClient]);

  async function loadPublicState(address: string) {
    try {
      setIsLoadingPublicState(true);
      setIsInvalidContract(false);
      const providers = buildReadonlyProviders();
      const contract = await joinQuoteOfTheDayContract(
        providers,
        address,
        null,
      );

      providers.publicDataProvider
        .contractStateObservable(contract.deployTxData.public.contractAddress, {
          type: "latest",
        })
        .subscribe((contractState: any) => {
          const state = ledger(contractState.data);
          setQuote(state.quoteOfTheDay);
          setOwnerPublicKey(toHex(state.owner));
          setIsLoadingPublicState(false);
        });
    } catch (err) {
      console.error("Failed to load public state:", err);
      setIsInvalidContract(true);
      setIsLoadingPublicState(false);
    }
  }

  function handleOpenWalletPicker() {
    const wallets = listWallets();
    setAvailableWallets(wallets);
    setIsWalletPickerOpen(true);
  }

  async function handleConnect(selectedWallet: InitialAPI) {
    try {
      setIsWalletPickerOpen(false);
      setIsConnecting(true);
      setErrorMessage(null);

      const connectedWallet = await connectBrowserWallet(selectedWallet);
      setWallet(connectedWallet);
      setWalletAddress(
        (await connectedWallet.getUnshieldedAddress()).unshieldedAddress,
      );
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        "Couldn't connect to your wallet. Please unlock it and try again.",
      );
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnect() {
    setWallet(null);
    setWalletAddress(null);
    setProvingClient(null);
    setIdentity(null);
    setTxState("idle");
  }

  async function handleIdentityLoaded(loadedIdentity: CreatorIdentity) {
    setIdentity(loadedIdentity);

    if (contractAddress !== loadedIdentity.contractAddress) {
      setContractAddress(loadedIdentity.contractAddress);
      const newUrl = `${window.location.pathname}?contract=${loadedIdentity.contractAddress}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
      await loadPublicState(loadedIdentity.contractAddress);
    }
  }

  async function handlePublish(newQuote: string) {
    if (!provingClient || !wallet || !identity) return;

    try {
      setTxState("proving");
      setTxHash(null);
      setErrorMessage(null);

      const hash = await provingClient.provePost(newQuote);

      setTxState("submitting");
      setTxHash(hash);
      setTxState("success");
      setIdentity(null);
    } catch (err: any) {
      console.error("Publish failed:", err);
      setErrorMessage("Proof generation or transaction failed.");
      setTxState("error");
    }
  }

  function copyShareLink() {
    if (contractAddress) {
      const url = `${window.location.origin}${window.location.pathname}?contract=${contractAddress}`;
      navigator.clipboard.writeText(url);
    }
  }

  function handleOpenSharedLink(e: React.SubmitEvent) {
    e.preventDefault();
    if (!sharedLinkInput) return;

    let targetContract = sharedLinkInput.trim();

    // Check if it's a full URL
    try {
      const url = new URL(targetContract);
      const param = url.searchParams.get("contract");
      if (param) {
        targetContract = param;
      }
    } catch (e) {
      // Not a valid URL, treat as direct contract ID if they pasted that instead
    }

    if (targetContract) {
      setContractAddress(targetContract);
      const newUrl = `${window.location.pathname}?contract=${targetContract}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
      loadPublicState(targetContract);
    }
  }

  const isCreatorView = !!walletAddress || !!identity;

  return (
    <div className="container mx-auto max-w-3xl flex-col min-h-screen">
      <Header />

      <main className="flex-col flex-1 gap-6 w-full">
        {!contractAddress && !isCreatorView && (
          <div className="animate-fade-in-up flex-col gap-8">
            <div className="card text-center relative overflow-hidden preview-card">
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center opacity-70 text-xs tracking-wide uppercase">
                <span className="badge badge-neutral">Preview</span>
                <span>Today</span>
              </div>
              <div className="mt-8 mb-4">
                <blockquote>
                  "The best way to predict the future is to create it."
                </blockquote>
                <p className="mt-6 text-xs opacity-50 text-center">
                  This is a sample quote demonstrating how shared quotes are
                  displayed.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="card primary-card flex-col justify-center items-center text-center gap-4">
                <h3>Create a Quote</h3>
                <p className="text-sm opacity-70 mb-2">
                  Connect your wallet to publish today's quote privately on
                  Midnight.
                </p>
                <button
                  onClick={handleOpenWalletPicker}
                  className="btn btn-primary w-full"
                >
                  Connect Wallet
                </button>
              </div>

              <div className="card flex-col justify-center items-center text-center gap-4">
                <h3>Read a Quote</h3>
                <p className="text-sm opacity-70 mb-2">
                  View any shared quote without connecting a wallet. Paste the
                  link here or visit it directly.
                </p>
                <form
                  onSubmit={handleOpenSharedLink}
                  className="flex gap-2 w-full"
                >
                  <input
                    type="text"
                    className="input"
                    placeholder="Paste link here..."
                    value={sharedLinkInput}
                    onChange={(e) => setSharedLinkInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn"
                    disabled={!sharedLinkInput}
                  >
                    Open
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {isInvalidContract && (
          <div className="card border-error bg-error-bg animate-fade-in-up">
            <h2 className="text-error">Couldn't Load Quote</h2>
            <p>
              The shared link appears to be invalid or the contract could not be
              loaded. Please verify the URL.
            </p>
          </div>
        )}

        {/* Reader View */}
        {contractAddress && !isCreatorView && !isInvalidContract && (
          <div className="animate-fade-in-up flex-col gap-6">
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-50 uppercase tracking-wide">
                Viewing Quote
              </span>
              <button
                onClick={handleOpenWalletPicker}
                className="btn btn-sm btn-ghost"
              >
                I am the Creator
              </button>
            </div>

            {isLoadingPublicState ? (
              <div className="flex-col gap-6">
                <div className="card">
                  <SkeletonText lines={1} width="40%" />
                  <div className="mt-4">
                    <SkeletonText lines={1} />
                  </div>
                </div>
                <div className="card">
                  <SkeletonText lines={2} />
                </div>
              </div>
            ) : (
              <>
                <OwnerCard ownerPublicKey={ownerPublicKey} isOwner={false} />
                <CurrentQuoteCard quote={quote} />
              </>
            )}
          </div>
        )}

        {/* Creator View */}
        {isCreatorView && (
          <div className="animate-fade-in-up flex-col gap-6">
            <div className="grid md:grid-cols-2">
              <WalletCard
                walletAddress={walletAddress}
                onConnect={handleOpenWalletPicker}
                onDisconnect={handleDisconnect}
                isConnecting={isConnecting}
              />

              {walletAddress && (
                <CreatorIdentitySelector
                  identity={identity}
                  onIdentityLoaded={handleIdentityLoaded}
                  onClear={() => setIdentity(null)}
                  expectedOwnerPublicKey={ownerPublicKey}
                />
              )}
            </div>

            {contractAddress && (
              <div className="flex-col gap-4 mt-2">
                <div className="flex gap-4 justify-between items-center">
                  <span className="text-xs opacity-50 uppercase tracking-wide">
                    Contract Data
                  </span>
                  <button
                    onClick={copyShareLink}
                    className="btn btn-sm flex gap-2"
                  >
                    <span>🔗</span> Copy Share Link
                  </button>
                </div>

                <CurrentQuoteCard quote={quote} />

                <PublishQuoteCard
                  onPublish={handlePublish}
                  isDisabled={
                    !provingClient ||
                    txState === "proving" ||
                    txState === "submitting"
                  }
                  disabledReason={
                    !provingClient
                      ? "Connect Wallet and select Creator Identity to publish."
                      : txState === "proving" || txState === "submitting"
                        ? "Transaction in progress..."
                        : null
                  }
                />
              </div>
            )}

            <TransactionStatusCard
              txState={txState}
              txHash={txHash}
              errorMessage={errorMessage}
            />
          </div>
        )}
      </main>

      <footer className="mt-12 text-center opacity-70 text-xs">
        <p>Inspiring the world anonymously. Powered by Midnight.</p>
      </footer>

      <WalletPicker
        isOpen={isWalletPickerOpen}
        wallets={availableWallets}
        onSelect={handleConnect}
        onClose={() => setIsWalletPickerOpen(false)}
      />
    </div>
  );
}

export default App;
