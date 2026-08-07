interface CurrentQuoteCardProps {
  quote: string | null;
}

export function CurrentQuoteCard({ quote }: CurrentQuoteCardProps) {
  return (
    <div className="card quote-card">
      <h2>Current Quote</h2>
      <div className="quote-content mt-4">
        {quote === null ? (
          <p className="opacity-70 italic">Loading quote...</p>
        ) : quote === "" ? (
          <p className="opacity-70 italic">No quote published yet.</p>
        ) : (
          <blockquote>"{quote}"</blockquote>
        )}
      </div>
    </div>
  );
}
