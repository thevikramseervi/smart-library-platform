import { useQuery } from "@tanstack/react-query";
import { History, Search, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDashboardDateTime } from "@/lib/format";
import { listAuditLogs } from "@/services/admin";
import type { AuditAction } from "@/types/auditLog";

const PAGE_SIZE = 20;
const actionLabels: Record<AuditAction, string> = {
  BOOK_CREATED: "Book added",
  BOOK_UPDATED: "Book updated",
  BOOK_DELETED: "Book removed",
  DIGITAL_RESOURCE_UPLOADED: "Digital PDF uploaded",
  DIGITAL_RESOURCE_REMOVED: "Digital PDF removed",
  COPY_CREATED: "Copy added",
  COPY_UPDATED: "Copy updated",
  USER_CREATED: "Account created",
  USER_UPDATED: "Account updated",
  USER_DEACTIVATED: "Account deactivated",
  USER_PASSWORD_RESET: "Password reset",
  DEPARTMENT_CREATED: "Department added",
  DEPARTMENT_UPDATED: "Department updated",
  DEPARTMENT_DELETED: "Department deleted",
  AUTHOR_CREATED: "Author added",
  AUTHOR_UPDATED: "Author updated",
  AUTHOR_DELETED: "Author removed",
  CATEGORY_CREATED: "Category added",
  CATEGORY_UPDATED: "Category updated",
  CATEGORY_DELETED: "Category removed",
  PUBLISHER_CREATED: "Publisher added",
  PUBLISHER_UPDATED: "Publisher updated",
  PUBLISHER_DELETED: "Publisher removed",
  LANGUAGE_CREATED: "Language added",
  BOOK_ISSUED: "Book issued",
  BOOK_RETURNED: "Book returned",
  BOOK_RENEWED: "Loan renewed",
  FINE_RECORDED: "Fine recorded",
  FINE_PAID: "Fine paid",
  CIRCULATION_POLICY_UPDATED: "Policy changed",
  RESERVATION_CREATED: "Reservation created",
  RESERVATION_CANCELLED: "Reservation cancelled",
  RESERVATION_EXPIRED: "Reservation expired",
  RESERVATION_FULFILLED: "Reservation fulfilled",
};

const actions = Object.keys(actionLabels) as AuditAction[];

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | "">("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", page, action, search.trim(), startDate, endDate],
    queryFn: () => listAuditLogs({
      page,
      page_size: PAGE_SIZE,
      action: action || undefined,
      q: search.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
    enabled: !invalidRange,
  });

  function resetFilters() {
    setPage(1);
    setAction("");
    setSearch("");
    setStartDate("");
    setEndDate("");
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Review who changed catalog records or accounts, handled circulation, and when. Entries are read-only."
      />

      <Card className="gap-4 border-border/70 bg-card/90 py-5 shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4 text-primary" aria-hidden="true" />
            Find an event
          </CardTitle>
          <CardDescription>Search staff, student, book, copy code, or event details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 sm:col-span-2 xl:col-span-1">
            <Label htmlFor="audit-search">Search</Label>
            <Input
              id="audit-search"
              value={search}
              onChange={(event) => { setPage(1); setSearch(event.target.value); }}
              placeholder="Name, book, or inventory code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-action">Action</Label>
            <Select
              value={action || "all"}
              onValueChange={(value) => { setPage(1); setAction(value === "all" ? "" : value as AuditAction); }}
            >
              <SelectTrigger id="audit-action" aria-label="Action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((value) => <SelectItem key={value} value={value}>{actionLabels[value]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-start-date">From</Label>
            <Input
              id="audit-start-date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => { setPage(1); setStartDate(event.target.value); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-end-date">To</Label>
            <Input
              id="audit-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => { setPage(1); setEndDate(event.target.value); }}
            />
          </div>
          <div className="sm:col-span-2 xl:col-span-4">
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X aria-hidden="true" />
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {invalidRange ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          The start date must be on or before the end date.
        </p>
      ) : null}

      {auditQuery.isLoading ? (
        <div className="space-y-3" aria-label="Loading audit log">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
        </div>
      ) : auditQuery.isError ? (
        <QueryErrorState message="Unable to load the audit log." onRetry={() => void auditQuery.refetch()} />
      ) : auditQuery.data ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {auditQuery.data.total} event{auditQuery.data.total === 1 ? "" : "s"}
          </p>
          {auditQuery.data.items.length ? (
            <div className="space-y-3">
              {auditQuery.data.items.map((event) => (
                <Card key={event.id} className="gap-3 border-border/70 bg-card/90 py-4 shadow-sm">
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
                        {actionLabels[event.action]}
                      </span>
                      <time className="text-xs text-muted-foreground" dateTime={event.occurred_at}>
                        {formatDashboardDateTime(event.occurred_at)}
                      </time>
                    </div>
                    <p className="font-medium leading-relaxed">{event.summary}</p>
                    <div className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
                      <History className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        {event.actor_name} <span className="text-xs">({event.actor_email})</span>
                      </span>
                    </div>
                    <details className="text-sm">
                      <summary className="w-fit cursor-pointer text-primary">Event details</summary>
                      <dl className="mt-3 grid gap-x-5 gap-y-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
                        <div><dt className="text-xs text-muted-foreground">Record</dt><dd>{event.entity_type} · {event.entity_id}</dd></div>
                        {Object.entries(event.details).map(([key, value]) => (
                          <div key={key} className="min-w-0">
                            <dt className="text-xs capitalize text-muted-foreground">{key.replaceAll("_", " ")}</dt>
                            <dd className="break-words">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed bg-card/60 py-10 text-center">
              <CardContent>
                <p className="font-medium">No audit events found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different search or date range.</p>
              </CardContent>
            </Card>
          )}
          <PaginationControls
            page={auditQuery.data.page}
            totalPages={auditQuery.data.total_pages}
            total={auditQuery.data.total}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </section>
  );
}
