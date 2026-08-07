export type TxState = "idle" | "proving" | "submitting" | "success" | "error";

interface TransactionStatusCardProps {
  txState: TxState;
  txHash: string | null;
  errorMessage: string | null;
}

export const Spinner: React.FC = () => <div className="spinner"></div>;

export function TransactionStatusCard({
  txState,
  txHash,
  errorMessage,
}: TransactionStatusCardProps) {
  if (txState === "idle") return null;

  return (
    <div className="card status-card mt-8">
      <h2>Transaction Status</h2>

      <div className="timeline mt-6">
        <div className="timeline-item active">
          <div className="icon">✓</div>
          <div className="content">Connected wallet</div>
        </div>

        <div
          className={`timeline-item ${txState === "proving" || txState === "submitting" || txState === "success" ? "active" : ""}`}
        >
          <div className="icon">
            {txState === "proving" ? <Spinner /> : "✓"}
          </div>
          <div className="content">
            Generated proof locally
            {txState === "proving" && (
              <p className="text-xs opacity-70 mt-1">
                Your private witness never leaves this device.
              </p>
            )}
          </div>
        </div>

        <div
          className={`timeline-item ${txState === "submitting" || txState === "success" ? "active" : ""}`}
        >
          <div className="icon">
            {txState === "submitting" ? (
              <Spinner />
            ) : txState === "success" ? (
              "✓"
            ) : (
              "⏳"
            )}
          </div>
          <div className="content">Submitted transaction</div>
        </div>

        <div
          className={`timeline-item ${txState === "success" ? "active" : ""}`}
        >
          <div className="icon">{txState === "success" ? "✓" : "⏳"}</div>
          <div className="content">Updated public ledger</div>
        </div>
      </div>

      {txState === "success" && (
        <div className="success-state mt-6 flex-col gap-4 items-center text-center">
          <h3 className="text-success text-xl">
            ✓ Quote published successfully
          </h3>
          <div className="badge badge-success-outline flex gap-2 items-center text-lg p-3">
            <span>🔒</span> Proved without revealing your Creator Identity
          </div>
          {txHash && (
            <div className="flex gap-2 items-center mt-2">
              <code className="text-xs break-all bg-code p-2 rounded">
                {txHash}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(txHash)}
                className="btn btn-sm"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      {txState === "error" && (
        <div className="error-state mt-6 p-4 rounded bg-error-bg border border-error">
          <h3 className="text-error mb-2">Transaction Failed</h3>
          <p className="text-sm">
            {errorMessage || "An unknown error occurred."}
          </p>
        </div>
      )}
    </div>
  );
}
