import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { getApiErrorMessage } from "@/lib/apiError";
import { appToast } from "@/lib/toast";
import { getSearchIndexStatus, requestSearchReindex } from "@/services/admin";

const queryKey = ["admin", "search-index"];

export function SearchIndexPage() {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const statusQuery = useQuery({
    queryKey,
    queryFn: getSearchIndexStatus,
    refetchInterval: (query) => query.state.data?.job?.status === "RUNNING" ? 3000 : false,
  });
  const reindexMutation = useMutation({
    mutationFn: requestSearchReindex,
    onSuccess: (job) => {
      setMutationError(null);
      setConfirmOpen(false);
      appToast.success(job.mode === "FULL" ? "Full search reindex started" : "Search indexing retry started");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => setMutationError(getApiErrorMessage(error, "Could not start the indexing job.")),
  });

  const status = statusQuery.data;
  const isRunning = status?.job?.status === "RUNNING" || reindexMutation.isPending;

  if (statusQuery.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-44" /></div>;
  }
  if (statusQuery.isError || !status) {
    return <QueryErrorState message="Could not load semantic search indexing status." onRetry={() => void statusQuery.refetch()} />;
  }

  const stats = [
    { label: "Catalog books", value: status.total_books, detail: "Active titles" },
    { label: "Indexed", value: status.indexed_books, detail: "Available to semantic search" },
    { label: "Pending", value: status.pending_books, detail: "Waiting for an indexing attempt" },
    { label: "Failed", value: status.failed_books, detail: "Can be retried" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Semantic search index"
        description="Monitor book embeddings and recover books that have not indexed successfully."
      />

      {!status.enabled ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Semantic search is disabled in backend configuration. Indexing actions are unavailable until it is enabled.</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2"><CardDescription>{stat.label}</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold tracking-tight">{stat.value}</p><p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="size-5 text-primary" aria-hidden="true" />Index maintenance</CardTitle>
          <CardDescription>Current embedding model: <span className="font-medium text-foreground">{status.model_name}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => { setMutationError(null); reindexMutation.mutate(false); }}
              disabled={!status.enabled || isRunning || (status.pending_books === 0 && status.failed_books === 0)}
            >
              {isRunning && status.job?.mode === "RETRY" ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
              Retry pending and failed
            </Button>
            <Button variant="outline" onClick={() => { setMutationError(null); setConfirmOpen(true); }} disabled={!status.enabled || isRunning}>
              <RefreshCw /> Rebuild entire index
            </Button>
            <Button variant="ghost" onClick={() => void statusQuery.refetch()} disabled={statusQuery.isFetching}>
              <RefreshCw className={statusQuery.isFetching ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>

          {mutationError ? <p role="alert" className="text-sm text-destructive">{mutationError}</p> : null}

          {status.job ? (
            <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
              <div className="flex items-center gap-2 font-semibold">
                {status.job.status === "RUNNING" ? (
                  <LoaderCircle className="size-4 animate-spin text-primary" />
                ) : status.job.status === "FAILED" ? (
                  <AlertTriangle className="size-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="size-4 text-primary" />
                )}
                {status.job.status === "RUNNING" ? "Indexing is running" : status.job.status === "FAILED" ? "Indexing failed" : "Last indexing run completed"}
                <span className="text-sm font-normal text-muted-foreground">· {status.job.mode === "FULL" ? "Full rebuild" : "Pending/failed retry"}</span>
              </div>
              {status.job.status === "RUNNING" ? (
                <p className="mt-2 text-sm text-muted-foreground">This can take a while for a large catalog. You can leave this page; progress is retained while the server process is running.</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Scanned {status.job.scanned}; indexed {status.job.indexed}; failed {status.job.failed}.</p>
              )}
              {status.job.error ? <p role="alert" className="mt-2 text-sm text-destructive">{status.job.error}</p> : null}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">Retry processes books that are missing an embedding or previously failed. A full rebuild regenerates embeddings for every active catalog book.</p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Rebuild the entire search index?"
        description={`This will regenerate embeddings for all ${status.total_books} active books using ${status.model_name}. Search results may be incomplete until it finishes.`}
        confirmLabel="Rebuild index"
        pending={reindexMutation.isPending}
        errorMessage={mutationError}
        onConfirm={() => reindexMutation.mutate(true)}
      />
    </div>
  );
}
