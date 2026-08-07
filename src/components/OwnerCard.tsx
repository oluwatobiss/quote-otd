interface OwnerCardProps {
  ownerPublicKey: string | null;
  isOwner: boolean;
}

export function OwnerCard({ ownerPublicKey, isOwner }: OwnerCardProps) {
  return (
    <div className="card">
      <h2>Owner</h2>
      <div className="flex-col gap-2">
        {ownerPublicKey ? (
          <code className="text-sm break-all" title={ownerPublicKey}>
            {ownerPublicKey.substring(0, 16)}...
            {ownerPublicKey.substring(ownerPublicKey.length - 16)}
          </code>
        ) : (
          <p>Loading owner...</p>
        )}

        <div className="mt-2">
          {isOwner ? (
            <div className="badge badge-accent">Owner detected</div>
          ) : (
            <div className="badge badge-neutral">Read-only mode</div>
          )}
        </div>
      </div>
    </div>
  );
}
