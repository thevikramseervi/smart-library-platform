import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  /** Called on the retry button; defaults to refetching every query. */
  onRetry?: () => void;
  message?: string;
}

export function QueryErrorState({
  onRetry,
  message = "Unable to load data.",
}: QueryErrorStateProps) {
  const queryClient = useQueryClient();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    queryClient.refetchQueries({ type: "active", stale: true });
  };

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {message}
      </div>
      <Button variant="outline" size="sm" onClick={handleRetry}>
        <RotateCcw className="size-4" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
