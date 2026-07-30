import { useState } from "react";
import type { CreatorIdentity } from "../midnightUtils";

interface CreatorIdentitySelectorProps {
  onIdentityLoaded: (identity: CreatorIdentity) => void;
  onClear: () => void;
  identity: CreatorIdentity | null;
  expectedOwnerPublicKey: string | null;
}

export const CreatorIdentitySelector: React.FC<
  CreatorIdentitySelectorProps
> = ({ onIdentityLoaded, onClear, identity, expectedOwnerPublicKey }) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as CreatorIdentity;

        if (
          !parsed.version ||
          !parsed.contractAddress ||
          !parsed.secretKey ||
          !parsed.ownerPublicKey
        ) {
          throw new Error("Invalid format. Missing required fields.");
        }

        if (
          expectedOwnerPublicKey &&
          parsed.ownerPublicKey !== expectedOwnerPublicKey
        ) {
          throw new Error(
            "This identity does not belong to the owner of this contract.",
          );
        }

        onIdentityLoaded(parsed);
      } catch (err: any) {
        setError(err.message || "Failed to parse identity file.");
      }

      // Clear file input
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="card">
      <h2>Creator Identity</h2>

      {identity ? (
        <div className="flex-col gap-4">
          <div className="badge badge-success-outline">Identity Loaded</div>
          <p className="text-sm">
            <strong>
              Your Creator Identity stays entirely on this device.
            </strong>{" "}
            It is used only to generate a zero-knowledge proof proving ownership
            of this contract. Only the proof and public transaction data are
            submitted to the Midnight network.
          </p>
          <button onClick={onClear} className="btn mt-2">
            Clear Identity
          </button>
        </div>
      ) : (
        <div className="flex-col gap-4">
          <p className="text-sm">
            Select your <code>.quoteotd</code> file to prove ownership.
          </p>

          <input
            type="file"
            accept=".quoteotd,.json"
            onChange={handleFileChange}
            className="input"
          />

          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      )}
    </div>
  );
};
