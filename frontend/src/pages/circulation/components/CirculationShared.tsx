import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  BookCopyStatusBadge,
  CirculationActionBadge,
  FineStatusBadge,
  LoanStatusBadge,
  ReservationStatusBadge,
  RoleBadge,
  StatusBadge,
  UserActivityBadge,
} from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export const TABLE_HEAD_CELL_CLASS =
  "px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
export const TABLE_BODY_CELL_CLASS = "px-5 py-3.5 align-middle";

export {
  BookCopyStatusBadge,
  CirculationActionBadge,
  FineStatusBadge,
  LoanStatusBadge,
  ReservationStatusBadge,
  RoleBadge,
  StatusBadge,
  UserActivityBadge,
};

interface CirculationPageHeaderProps {
  title: string;
  description?: string;
}

export function CirculationPageHeader({ title, description }: CirculationPageHeaderProps) {
  return <PageHeader title={title} description={description} />;
}

interface CirculationTableProps {
  children: ReactNode;
  recordCount?: number;
  ariaLabel?: string;
  mobileContent?: ReactNode;
}

export function CirculationTable({
  children,
  recordCount,
  ariaLabel = "Circulation table",
  mobileContent,
}: CirculationTableProps) {
  return (
    <div className="space-y-2">
      {recordCount != null ? (
        <p className="text-xs text-muted-foreground">
          {recordCount} record{recordCount === 1 ? "" : "s"}
        </p>
      ) : null}
      {mobileContent ? <div className="space-y-3 md:hidden">{mobileContent}</div> : null}
      <div className={mobileContent ? "hidden md:block" : undefined}>
        <div
          className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain rounded-2xl border border-border/70 bg-card/70 shadow-sm"
          role="region"
          aria-label={ariaLabel}
          tabIndex={0}
        >
          <table className="w-full min-w-[42rem] text-sm sm:min-w-full">{children}</table>
        </div>
        {!mobileContent ? (
          <p className="px-1 pt-2 text-xs text-muted-foreground sm:hidden">Swipe horizontally to see all columns.</p>
        ) : null}
      </div>
    </div>
  );
}

interface CirculationRecordCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  fields: Array<{ label: string; value: ReactNode; wide?: boolean }>;
  action?: ReactNode;
}

export function CirculationRecordCard({
  title,
  subtitle,
  status,
  fields,
  action,
}: CirculationRecordCardProps) {
  return (
    <article className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold leading-snug">{title}</h3>
          {subtitle ? <div className="mt-1 break-words text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-3">
        {fields.map((field) => (
          <div key={field.label} className={field.wide ? "col-span-2 min-w-0" : "min-w-0"}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {field.label}
            </dt>
            <dd className="mt-1 break-words text-sm">{field.value}</dd>
          </div>
        ))}
      </dl>
      {action ? <div className="mt-4 flex justify-end border-t border-border/60 pt-3">{action}</div> : null}
    </article>
  );
}

interface CirculationTableHeadProps {
  columns: string[];
  sticky?: boolean;
}

export function CirculationTableHead({ columns, sticky = true }: CirculationTableHeadProps) {
  return (
    <thead
      className={cn(
        "border-b border-border/60 bg-secondary/35",
        sticky && "sticky top-0 z-10 bg-background/95 backdrop-blur-sm",
      )}
    >
      <tr>
        {columns.map((column) => (
          <th key={column} className={TABLE_HEAD_CELL_CLASS}>
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export { PaginationControls };

export function CirculationNavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {label}
    </Link>
  );
}
