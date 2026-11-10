import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  BookOpen,
  BookmarkPlus,
  CalendarDays,
  CircleX,
  Clock3,
  Download,
  Hourglass,
  IndianRupee,
  LibraryBig,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { formatInr } from "@/lib/formatCurrency";
import { buildCirculationReportCsv } from "@/lib/circulationReportCsv";
import {
  CirculationTrendCharts,
  ReservationTrendChart,
} from "@/pages/admin/CirculationTrendCharts";
import { getCirculationReport } from "@/services/dashboard";

function utcDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ReportMetric({
  label,
  value,
  description,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <Card className="gap-3 border-border/70 bg-card/90 py-5 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${accent}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

export function CirculationReportsPage() {
  const [startDate, setStartDate] = useState(() => utcDateOffset(-29));
  const [endDate, setEndDate] = useState(() => utcDateOffset(0));
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const reportQuery = useQuery({
    queryKey: ["reports", "circulation", startDate, endDate],
    queryFn: () => getCirculationReport(startDate, endDate),
    enabled: Boolean(startDate && endDate) && !invalidRange,
  });

  function downloadReportCsv() {
    if (!reportQuery.data) return;

    const blob = new Blob([buildCirculationReportCsv(reportQuery.data)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `library-analytics_${reportQuery.data.start_date}_${reportQuery.data.end_date}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Library Analytics"
        description="Explore circulation activity, reservation demand, fine collections, and popular books for a selected period."
        actions={(
          <Button
            type="button"
            variant="outline"
            onClick={downloadReportCsv}
            disabled={!reportQuery.data || invalidRange}
          >
            <Download aria-hidden="true" />
            Download CSV
          </Button>
        )}
      />

      <Card className="gap-4 border-border/70 bg-card/90 py-5 shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            Report period
          </CardTitle>
          <CardDescription>Dates use the library’s UTC calendar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="report-start-date">From</Label>
            <Input
              id="report-start-date"
              type="date"
              value={startDate}
              max={endDate || utcDateOffset(0)}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-end-date">To</Label>
            <Input
              id="report-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={utcDateOffset(0)}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {invalidRange ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          The start date must be on or before the end date.
        </p>
      ) : null}

      {reportQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading circulation report">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : reportQuery.isError ? (
        <QueryErrorState
          message="Unable to load the circulation report."
          onRetry={() => void reportQuery.refetch()}
        />
      ) : reportQuery.data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {formatDate(reportQuery.data.start_date)} – {formatDate(reportQuery.data.end_date)}
          </p>
          <Tabs defaultValue="overview">
            <TabsList aria-label="Analytics sections">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="circulation">Circulation</TabsTrigger>
              <TabsTrigger value="reservations">Reservations</TabsTrigger>
              <TabsTrigger value="collection">Collection</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportMetric
                  label="Loans issued"
                  value={reportQuery.data.loans_issued}
                  description="Issued during this period"
                  icon={BookOpen}
                  accent="bg-sky-100 text-sky-700"
                />
                <ReportMetric
                  label="Returns processed"
                  value={reportQuery.data.returns_processed}
                  description="Returned during this period"
                  icon={RotateCcw}
                  accent="bg-emerald-100 text-emerald-700"
                />
                <ReportMetric
                  label="Overdue at period end"
                  value={reportQuery.data.overdue_at_period_end}
                  description="Still overdue at the end date"
                  icon={TriangleAlert}
                  accent="bg-amber-100 text-amber-700"
                />
                <ReportMetric
                  label="Fines collected"
                  value={formatInr(reportQuery.data.fines_collected)}
                  description="Payments recorded during this period"
                  icon={IndianRupee}
                  accent="bg-violet-100 text-violet-700"
                />
              </div>
              <CirculationTrendCharts
                data={reportQuery.data.trend}
                interval={reportQuery.data.trend_interval}
              />
            </TabsContent>

            <TabsContent value="circulation" className="space-y-6">
              <section className="space-y-4" aria-labelledby="return-performance-heading">
              <div>
                <h2 id="return-performance-heading" className="text-lg font-semibold tracking-tight">
                  Return performance
                </h2>
                <p className="text-sm text-muted-foreground">
                  On-time and late returns processed during the selected period.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportMetric
                  label="On-time return rate"
                  value={
                    reportQuery.data.on_time_return_rate_percent === null
                      ? "—"
                      : `${Number(reportQuery.data.on_time_return_rate_percent).toFixed(1)}%`
                  }
                  description={`${reportQuery.data.on_time_returns} of ${reportQuery.data.returns_processed} returns on time`}
                  icon={BadgeCheck}
                  accent="bg-emerald-100 text-emerald-700"
                />
                <ReportMetric
                  label="Late returns"
                  value={reportQuery.data.late_returns}
                  description="Returned after the due date"
                  icon={TriangleAlert}
                  accent="bg-amber-100 text-amber-700"
                />
                <ReportMetric
                  label="Average days late"
                  value={
                    reportQuery.data.average_days_late === null
                      ? "—"
                      : Number(reportQuery.data.average_days_late).toFixed(1)
                  }
                  description="Among late returns in this period"
                  icon={Clock3}
                  accent="bg-orange-100 text-orange-700"
                />
                <ReportMetric
                  label="Current unpaid fines"
                  value={formatInr(reportQuery.data.current_unpaid_fine_balance)}
                  description={`${reportQuery.data.current_unpaid_fine_count} unpaid fine records currently`}
                  icon={IndianRupee}
                  accent="bg-rose-100 text-rose-700"
                />
              </div>
              <Card className="gap-4 border-border/70 bg-card/90 py-5 shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base">Overdue age at period end</CardTitle>
                  <CardDescription>
                    Active loans grouped by how many days overdue they were on the selected end date.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const buckets = [
                      { label: "1–7 days", count: reportQuery.data.overdue_1_7_days_at_period_end },
                      { label: "8–30 days", count: reportQuery.data.overdue_8_30_days_at_period_end },
                      { label: "31+ days", count: reportQuery.data.overdue_31_plus_days_at_period_end },
                    ];
                    const maximum = Math.max(1, ...buckets.map((bucket) => bucket.count));
                    return buckets.map((bucket) => (
                      <div key={bucket.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3">
                        <span className="text-sm text-muted-foreground">{bucket.label}</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${(bucket.count / maximum) * 100}%` }}
                          />
                        </div>
                        <span className="text-right text-sm font-semibold tabular-nums">{bucket.count}</span>
                      </div>
                    ));
                  })()}
                </CardContent>
              </Card>
              </section>
            </TabsContent>

            <TabsContent value="reservations" className="space-y-6">
              <section className="space-y-4" aria-labelledby="reservation-analytics-heading">
                <div>
                  <h2 id="reservation-analytics-heading" className="text-lg font-semibold tracking-tight">
                    Reservation demand
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Outcomes are grouped by the date their status changed.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <ReportMetric
                    label="Reservations placed"
                    value={reportQuery.data.reservations_placed}
                    description="Created during this period"
                    icon={BookmarkPlus}
                    accent="bg-sky-100 text-sky-700"
                  />
                  <ReportMetric
                    label="Fulfilled"
                    value={reportQuery.data.reservations_fulfilled}
                    description="Issued to waiting students"
                    icon={BadgeCheck}
                    accent="bg-emerald-100 text-emerald-700"
                  />
                  <ReportMetric
                    label="Expired"
                    value={reportQuery.data.reservations_expired}
                    description="Hold window elapsed"
                    icon={Clock3}
                    accent="bg-amber-100 text-amber-700"
                  />
                  <ReportMetric
                    label="Cancelled"
                    value={reportQuery.data.reservations_cancelled}
                    description="Cancelled by student or staff"
                    icon={CircleX}
                    accent="bg-rose-100 text-rose-700"
                  />
                  <ReportMetric
                    label="Average wait to fulfillment"
                    value={
                      reportQuery.data.average_reservation_wait_days === null
                        ? "—"
                        : `${Number(reportQuery.data.average_reservation_wait_days).toFixed(1)} days`
                    }
                    description="From reservation to issue"
                    icon={Hourglass}
                    accent="bg-violet-100 text-violet-700"
                  />
                </div>
                <ReservationTrendChart
                  data={reportQuery.data.reservation_trend}
                  interval={reportQuery.data.trend_interval}
                />
              </section>

            </TabsContent>

            <TabsContent value="collection" className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="gap-0 overflow-hidden border-border/70 bg-card/90 py-0 shadow-sm">
                  <CardHeader className="border-b border-border/70 py-5">
                    <CardTitle className="text-base">Most borrowed books</CardTitle>
                    <CardDescription>Ranked by loans issued during the selected period.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {reportQuery.data.popular_books.length ? (
                      <ol className="divide-y divide-border/70">
                        {reportQuery.data.popular_books.map((book, index) => (
                          <li
                            key={`${book.book_title}-${index}`}
                            className="flex items-center justify-between gap-4 px-5 py-4"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">
                                {index + 1}
                              </span>
                              <span className="truncate font-medium">{book.book_title}</span>
                            </div>
                            <span className="shrink-0 text-sm text-muted-foreground">
                              {book.loans_issued} {book.loans_issued === 1 ? "loan" : "loans"}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        No loans were issued during this period.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="gap-0 overflow-hidden border-border/70 bg-card/90 py-0 shadow-sm">
                  <CardHeader className="border-b border-border/70 py-5">
                    <CardTitle className="text-base">Popular categories</CardTitle>
                    <CardDescription>
                      By loans issued. Books with multiple categories count in each one.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {reportQuery.data.popular_categories.length ? (
                      <ol className="divide-y divide-border/70">
                        {reportQuery.data.popular_categories.map((category, index) => {
                          const maxLoans = reportQuery.data.popular_categories[0]?.loans_issued ?? 1;
                          const barWidth = maxLoans > 0 ? (category.loans_issued / maxLoans) * 100 : 0;
                          return (
                            <li key={category.category_name} className="space-y-2 px-5 py-3.5">
                              <div className="flex items-center justify-between gap-4 text-sm">
                                <span className="min-w-0 truncate font-medium">
                                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                                  {category.category_name}
                                </span>
                                <span className="shrink-0 text-muted-foreground">
                                  {category.loans_issued} {category.loans_issued === 1 ? "loan" : "loans"}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        No categorized loans were recorded during this period.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="gap-0 overflow-hidden border-border/70 bg-card/90 py-0 shadow-sm">
                <CardHeader className="border-b border-border/70 py-5">
                  <CardTitle className="text-base">Student participation by department</CardTitle>
                  <CardDescription>
                    Share of currently active students who borrowed at least once in this period. Lowest participation appears first; only department totals are shown.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {reportQuery.data.department_participation.length ? (
                    <ol className="divide-y divide-border/70">
                      {reportQuery.data.department_participation.map((department) => (
                        <li key={department.department_name} className="space-y-2 px-5 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                            <span className="font-medium">{department.department_name}</span>
                            <span className="text-muted-foreground">
                              {department.borrowing_students} of {department.active_students} students · {department.loans_issued} {department.loans_issued === 1 ? "loan" : "loans"}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-primary">
                              {Number(department.participation_rate_percent).toFixed(1)}%
                            </span>
                          </div>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-secondary"
                            role="progressbar"
                            aria-label={`${department.department_name} borrowing participation`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Number(department.participation_rate_percent)}
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, Number(department.participation_rate_percent))}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No active students are currently assigned to a department.
                    </p>
                  )}
                </CardContent>
              </Card>

              <section className="space-y-4" aria-labelledby="collection-health-heading">
                <div>
                  <h2 id="collection-health-heading" className="text-lg font-semibold tracking-tight">
                    Collection health
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Current copy availability alongside borrowing activity for the selected period.
                  </p>
                </div>

                <Card className="gap-4 border-border/70 bg-card/90 py-5 shadow-sm">
                  <CardHeader className="pb-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <LibraryBig className="size-4 text-primary" aria-hidden="true" />
                      Current copy status
                    </CardTitle>
                    <CardDescription>Physical copies across active catalog titles.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {[
                      ["Total copies", reportQuery.data.inventory_status.total_copies],
                      ["Available", reportQuery.data.inventory_status.available_copies],
                      ["Borrowed", reportQuery.data.inventory_status.borrowed_copies],
                      ["Reserved", reportQuery.data.inventory_status.reserved_copies],
                      ["Out of service", reportQuery.data.inventory_status.out_of_service_copies],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-secondary/60 px-3 py-3">
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="gap-0 overflow-hidden border-border/70 bg-card/90 py-0 shadow-sm">
                    <CardHeader className="border-b border-border/70 py-5">
                      <CardTitle className="text-base">Reservation pressure</CardTitle>
                      <CardDescription>
                        Titles where waiting reservations exceed both reserved and currently available copies.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {reportQuery.data.reservation_pressure_books.length ? (
                        <ol className="divide-y divide-border/70">
                          {reportQuery.data.reservation_pressure_books.map((book, index) => (
                            <li key={`${book.book_title}-${index}`} className="space-y-1 px-5 py-4">
                              <p className="font-medium">{book.book_title}</p>
                              <p className="text-sm text-muted-foreground">
                                {book.waiting_reservations} waiting · {book.reserved_copies} reserved · {book.available_copies} available · {book.loans_issued} {book.loans_issued === 1 ? "loan" : "loans"} in period
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="px-5 py-6 text-sm text-muted-foreground">
                          No titles currently have more waiting reservations than available copies.
                        </p>
                      )}
                      {reportQuery.data.reservation_pressure_title_count > reportQuery.data.reservation_pressure_books.length ? (
                        <p className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
                          Showing {reportQuery.data.reservation_pressure_books.length} of {reportQuery.data.reservation_pressure_title_count} titles.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="gap-0 overflow-hidden border-border/70 bg-card/90 py-0 shadow-sm">
                    <CardHeader className="border-b border-border/70 py-5">
                      <CardTitle className="text-base">Available titles with no loans</CardTitle>
                      <CardDescription>
                        No issues during the selected period; this is a review signal, not a recommendation to remove a title.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {reportQuery.data.no_loan_books.length ? (
                        <ol className="divide-y divide-border/70">
                          {reportQuery.data.no_loan_books.map((book, index) => (
                            <li key={`${book.book_title}-${index}`} className="flex items-center justify-between gap-4 px-5 py-4">
                              <span className="min-w-0 truncate font-medium">{book.book_title}</span>
                              <span className="shrink-0 text-sm text-muted-foreground">
                                {book.available_copies} available
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="px-5 py-6 text-sm text-muted-foreground">
                          No titles with available copies and no borrowing or active reservations were found for this period.
                        </p>
                      )}
                      {reportQuery.data.no_loan_title_count > reportQuery.data.no_loan_books.length ? (
                        <p className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
                          Showing {reportQuery.data.no_loan_books.length} of {reportQuery.data.no_loan_title_count} titles.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </section>
  );
}
