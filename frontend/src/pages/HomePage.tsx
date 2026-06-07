import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { fetchHealth } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Platform Status</h2>
        <p className="text-muted-foreground">
          Verify frontend, backend, and database connectivity for local development.
        </p>
        {user ? (
          <p className="text-sm text-muted-foreground">Logged in as {user.email}</p>
        ) : null}
      </div>

      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        {isLoading || isFetching ? (
          <p className="text-sm text-muted-foreground">Checking backend health...</p>
        ) : isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Unable to reach the backend API. Ensure the FastAPI server and PostgreSQL are running.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">API Status</dt>
              <dd className="mt-1 font-semibold capitalize">{data?.status}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Database</dt>
              <dd className="mt-1 font-semibold capitalize">{data?.database}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
