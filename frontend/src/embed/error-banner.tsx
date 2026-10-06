import { Button } from "@/components/ui/button";

import { MISSING_KEY_ERROR, type EmbedError } from "./errors";
import { describeReceivedUrl } from "./params";

export function EmbedErrorBanner({
  error,
  hasData,
  onRetry,
}: {
  error: EmbedError;
  hasData: boolean;
  /** Omitted when retrying cannot help, e.g. a missing or rejected key. */
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="container mx-auto mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <div className="min-w-0">
        <p>{hasData ? `${error.message} — showing last data` : error.message}</p>
        {error === MISSING_KEY_ERROR ? (
          <p className="break-all font-mono text-xs text-muted-foreground">
            Received: {describeReceivedUrl()}
          </p>
        ) : null}
      </div>
      {onRetry && error.status !== 401 ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
