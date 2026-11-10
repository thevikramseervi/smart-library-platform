import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookmarkPlus,
  CalendarDays,
  CircleAlert,
  IndianRupee,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInr } from "@/lib/formatCurrency";
import { getCirculationReport } from "@/services/dashboard";

function utcDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function AdminAnalyticsOverview() {
  const startDate = utcDateOffset(-29);
  const endDate = utcDateOffset(0);
  const reportQuery = useQuery({
    queryKey: ["reports", "circulation", startDate, endDate],
    queryFn: () => getCirculationReport(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card className="gap-0 overflow-hidden border-primary/15 bg-card/90 py-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp aria-hidden="true" className="size-4 text-primary" />
            Analytics overview
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            Last 30 days
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/admin/analytics">
            View analytics <ArrowUpRight aria-hidden="true" className="ml-1 size-4" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="px-5 py-4 sm:px-6">
        {reportQuery.isError ? (
          <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className="text-sm text-muted-foreground">
              Analytics summary couldn’t be loaded.
            </p>
            <Button variant="ghost" size="sm" onClick={() => void reportQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : reportQuery.isLoading || !reportQuery.data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading analytics overview">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Loans issued" value={reportQuery.data.loans_issued} icon={TrendingUp} />
              <Metric label="Returns processed" value={reportQuery.data.returns_processed} icon={RotateCcw} />
              <Metric
                label="Overdue at period end"
                value={reportQuery.data.overdue_at_period_end}
                icon={CircleAlert}
                to="/circulation/loans?filter=overdue"
              />
              <Metric label="Fines collected" value={formatInr(reportQuery.data.fines_collected)} icon={IndianRupee} />
            </div>
            <div className="mt-5 border-t border-border/70 pt-4">
              <h3 className="mb-3 text-sm font-semibold">Needs attention</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <AttentionLink
                  to="/circulation/reservations"
                  title="Reservation pressure"
                  value={`${reportQuery.data.reservation_pressure_title_count} ${reportQuery.data.reservation_pressure_title_count === 1 ? "title" : "titles"}`}
                  description="Waiting queues exceed available copies"
                  icon={BookmarkPlus}
                />
                <AttentionLink
                  to="/circulation/fines"
                  title="Current unpaid fines"
                  value={`${reportQuery.data.current_unpaid_fine_count} · ${formatInr(reportQuery.data.current_unpaid_fine_balance)}`}
                  description="Outstanding fines across the library"
                  icon={IndianRupee}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  to,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  to?: string;
}) {
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      </div>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="-m-2 block rounded-lg p-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function AttentionLink({
  to,
  title,
  value,
  description,
  icon: Icon,
}: {
  to: string;
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
