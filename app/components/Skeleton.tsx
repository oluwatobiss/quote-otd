interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  borderRadius?: string;
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  width?: string;
}

export function Skeleton({
  className = "",
  width = "100%",
  height = "1.5rem",
  borderRadius = "0.25rem",
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-loader ${className}`}
      style={{ width, height, borderRadius }}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
  width,
}: SkeletonTextProps) {
  return (
    <div className={`flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="1.25rem"
          width={width || (i === lines - 1 && lines > 1 ? "70%" : "100%")}
        />
      ))}
    </div>
  );
}
