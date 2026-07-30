import { useEffect } from "react";
import type { InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

interface WalletPickerProps {
  isOpen: boolean;
  wallets: InitialAPI[];
  onSelect: (wallet: InitialAPI) => void;
  onClose: () => void;
}

export function WalletPicker({
  isOpen,
  wallets,
  onSelect,
  onClose,
}: WalletPickerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-picker-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 id="wallet-picker-title">Connect Wallet</h2>
        <p className="text-sm opacity-70 mb-6">
          Select a wallet to securely connect to Quote of the Day.
        </p>

        {wallets.length === 0 ? (
          <div
            className="text-center p-4 bg-code border border-border"
            style={{ borderRadius: "0.5rem" }}
          >
            <p className="text-sm">No Midnight wallets detected.</p>
            <p className="text-xs opacity-50 mt-2">
              Please install a Midnight compatible extension (e.g. Lace) to
              continue.
            </p>
          </div>
        ) : (
          <div className="flex-col">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                className="wallet-option w-full"
                onClick={() => onSelect(wallet)}
                aria-label={`Connect with ${wallet.name}`}
              >
                {wallet.icon ? (
                  <img src={wallet.icon} alt="" className="wallet-icon" />
                ) : (
                  <div className="wallet-icon flex items-center justify-center bg-code border border-border">
                    <span className="text-xs">W</span>
                  </div>
                )}
                <div className="flex-col" style={{ alignItems: "flex-start" }}>
                  <span className="wallet-name">{wallet.name}</span>
                  <span className="text-xs opacity-50">Installed</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
