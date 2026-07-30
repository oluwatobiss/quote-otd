import { useState } from "react";

interface PublishQuoteCardProps {
  onPublish: (quote: string) => void;
  isDisabled: boolean;
  disabledReason: string | null;
}

export const PublishQuoteCard: React.FC<PublishQuoteCardProps> = ({
  onPublish,
  isDisabled,
  disabledReason,
}) => {
  const [quoteInput, setQuoteInput] = useState("");

  const handlePublish = () => {
    if (quoteInput.trim()) {
      onPublish(quoteInput.trim());
      setQuoteInput("");
    }
  };

  return (
    <div className="card">
      <h2>Publish Quote</h2>
      <div className="flex-col gap-4 mt-4">
        <textarea
          value={quoteInput}
          onChange={(e) => setQuoteInput(e.target.value)}
          placeholder="Enter a new quote..."
          className="textarea"
          disabled={isDisabled}
          rows={3}
        />

        <button
          onClick={handlePublish}
          disabled={isDisabled || !quoteInput.trim()}
          className="btn btn-primary"
        >
          Publish Quote
        </button>

        {isDisabled && disabledReason && (
          <p className="text-sm text-error">{disabledReason}</p>
        )}
      </div>
    </div>
  );
};
