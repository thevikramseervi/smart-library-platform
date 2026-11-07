import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  /** Refetch only the failed request. */
  onRetry: () => void;
  message?: string;
}

export function QueryErrorState({
  onRetry,
  message = "Unable to load data.",
}: QueryErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {message}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw className="size-4" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
