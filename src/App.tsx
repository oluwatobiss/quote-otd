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
import { ledger } from "../contracts/managed/quote-otd/contract/index.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import {
  buildAppProviders,
  buildReadonlyProviders,
  connectBrowserWallet,
  joinQuoteOfTheDayContract,
  MidnightProvingClient,
  type CreatorIdentity,
  type DAppConnectorWrapper,
} from "./midnightUtils";

function App() {
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [isInvalidContract, setIsInvalidContract] = useState(false);

  const [wallet, setWallet] = useState<DAppConnectorWrapper | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const [identity, setIdentity] = useState<CreatorIdentity | null>(null);

  const [quote, setQuote] = useState<string | null>(null);
  const [ownerPublicKey, setOwnerPublicKey] = useState<string | null>(null);

  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References to our Midnight instances
  const [provingClient, setProvingClient] =
    useState<MidnightProvingClient | null>(null);

  // Parse URL for contract address on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contractParam = params.get("contract");

    if (contractParam) {
      if (contractParam.length > 10) {
        // basic sanity check
        setContractAddress(contractParam);
        loadPublicState(contractParam);
      } else {
        setIsInvalidContract(true);
      }
    }
  }, []);

  const loadPublicState = async (address: string) => {
    try {
      const providers = await buildReadonlyProviders();
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
        });
    } catch (err) {
      console.error("Failed to load public state:", err);
      setIsInvalidContract(true);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setErrorMessage(null);

      const connectedWallet = await connectBrowserWallet();
      setWallet(connectedWallet);
      setWalletAddress(connectedWallet.getCoinPublicKey());
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setWallet(null);
    setWalletAddress(null);
    setProvingClient(null);
    setIdentity(null);
    setTxState("idle");
  };

  const handleIdentityLoaded = async (loadedIdentity: CreatorIdentity) => {
    setIdentity(loadedIdentity);

    // If we're not currently viewing a contract, or we're viewing a different one, update the URL!
    if (contractAddress !== loadedIdentity.contractAddress) {
      setContractAddress(loadedIdentity.contractAddress);

      // Update URL without reload
      const newUrl = `${window.location.pathname}?contract=${loadedIdentity.contractAddress}`;
      window.history.pushState({ path: newUrl }, "", newUrl);

      // Load the contract state
      await loadPublicState(loadedIdentity.contractAddress);
    }

    if (wallet) {
      // If wallet is connected, initialize proving client
      try {
        const { providers, stateProvider } = await buildAppProviders(
          wallet,
          loadedIdentity,
        );
        const contract = await joinQuoteOfTheDayContract(
          providers,
          loadedIdentity.contractAddress,
          loadedIdentity,
        );
        setProvingClient(new MidnightProvingClient(contract, stateProvider));
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to initialize proving client.");
      }
    }
  };

  const handlePublish = async (newQuote: string) => {
    if (!provingClient || !wallet || !identity) return;

    try {
      setTxState("proving");
      setTxHash(null);
      setErrorMessage(null);

      // This performs the zero-knowledge proof locally and clears the secret from memory instantly
      const hash = await provingClient.provePost(newQuote);

      setTxState("submitting");

      setTxHash(hash);
      setTxState("success");

      // Instantly purge the identity from React state
      setIdentity(null);
    } catch (err: any) {
      console.error("Publish failed:", err);
      setErrorMessage(err.message || "Proof generation or transaction failed.");
      setTxState("error");
    }
  };

  const copyShareLink = () => {
    if (contractAddress) {
      const url = `${window.location.origin}${window.location.pathname}?contract=${contractAddress}`;
      navigator.clipboard.writeText(url);
    }
  };

  // UI States
  const isCreatorView = !!walletAddress || !!identity;

  return (
    <div className="container mx-auto max-w-3xl p-4 md:p-8 flex-col gap-6">
      <Header />

      {!contractAddress && !isCreatorView && (
        <div className="card text-center p-8 mt-8 border border-dashed border-border opacity-70">
          <h2 className="mb-4">No Contract Specified</h2>
          <p>
            Please provide a valid <code>?contract=</code> URL parameter to view
            a quote.
          </p>
          <div className="divider my-6 text-sm">OR</div>
          <p className="mb-4 text-sm">
            If you are a creator, connect your wallet to manage your contract.
          </p>
          <button onClick={handleConnect} className="btn btn-primary">
            Connect Wallet
          </button>
        </div>
      )}

      {isInvalidContract && (
        <div className="card error-state">
          <h2>Error</h2>
          <p>
            The specified contract could not be loaded. Please verify the URL.
          </p>
        </div>
      )}

      {/* Reader View */}
      {contractAddress && !isCreatorView && (
        <>
          <div className="flex gap-4 justify-between items-center mb-2">
            <span className="text-xs opacity-50 uppercase tracking-wide">
              Viewing Contract
            </span>
            <button onClick={handleConnect} className="btn btn-sm">
              I am the Creator
            </button>
          </div>

          <OwnerCard ownerPublicKey={ownerPublicKey} isOwner={false} />
          <CurrentQuoteCard quote={quote} />
        </>
      )}

      {/* Creator View */}
      {isCreatorView && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <WalletCard
              walletAddress={walletAddress}
              onConnect={handleConnect}
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
        </>
      )}
    </div>
  );
}

export default App;
