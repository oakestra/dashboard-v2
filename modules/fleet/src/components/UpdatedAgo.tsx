import { useEffect, useState } from 'react';

function agoLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} h ago`;
}

/** Its own component so the once-a-second tick does not rerender the board. */
export function UpdatedAgo({ updatedAt }: { updatedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!Number.isFinite(updatedAt)) return null;
  // `now` lags a fresh `updatedAt` by up to a second.
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  return (
    <span className="text-muted-foreground text-xs tabular-nums" data-testid="fleet-updated">
      Updated {agoLabel(seconds)}
    </span>
  );
}
