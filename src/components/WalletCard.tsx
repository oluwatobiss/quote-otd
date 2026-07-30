interface WalletCardProps {
  walletAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  walletAddress,
  onConnect,
  onDisconnect,
  isConnecting,
}) => {
  return (
    <div className="card">
      <h2>Midnight Wallet</h2>

      {walletAddress ? (
        <div className="flex-col gap-2">
          <div className="badge badge-success">Connected</div>
          <code className="text-sm break-all">{walletAddress}</code>
          <button onClick={onDisconnect} className="btn mt-4">
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex-col gap-4">
          <p className="text-sm">
            Connect a Midnight Wallet extension (like 1AM) to pay transaction
            fees when publishing.
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
};
