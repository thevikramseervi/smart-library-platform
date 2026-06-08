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
}

export function CirculationTable({ children, recordCount }: CirculationTableProps) {
  return (
    <div className="space-y-2">
      {recordCount != null ? (
        <p className="text-xs text-muted-foreground">
          {recordCount} record{recordCount === 1 ? "" : "s"}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
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
        "border-b bg-muted/50",
        sticky && "sticky top-0 z-10 bg-muted/95 backdrop-blur-sm",
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

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
