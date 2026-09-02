interface WalletCardProps {
  walletAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
}

export function WalletCard({
  walletAddress,
  onConnect,
  onDisconnect,
  isConnecting,
}: WalletCardProps) {
  return (
    <div className="card">
      <h2>Midnight Wallet</h2>

      {walletAddress ? (
        <div className="flex-col gap-2">
          <div
            className="badge badge-success"
            style={{ alignSelf: "flex-start" }}
          >
            Connected
          </div>
          <code className="text-sm break-all opacity-70 mt-2">
            {walletAddress}
          </code>
          <button
            onClick={onDisconnect}
            className="btn btn-ghost mt-2"
            style={{ alignSelf: "flex-start" }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex-col gap-4">
          <p className="text-sm opacity-70">
            Connect a Midnight compatible wallet (such as 1AM) to manage
            contracts and publish zero-knowledge quotes.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="btn btn-primary"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
