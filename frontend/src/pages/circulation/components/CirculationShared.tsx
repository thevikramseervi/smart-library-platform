import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface CirculationPageHeaderProps {
  title: string;
  description?: string;
}

export function CirculationPageHeader({ title, description }: CirculationPageHeaderProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

interface CirculationTableProps {
  children: ReactNode;
}

export function CirculationTable({ children }: CirculationTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

interface CirculationTableHeadProps {
  columns: string[];
}

export function CirculationTableHead({ columns }: CirculationTableHeadProps) {
  return (
    <thead className="border-b bg-muted/50">
      <tr>
        {columns.map((column) => (
          <th key={column} className="px-4 py-3 text-left font-medium text-muted-foreground">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function StatusBadge({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "warning" | "success";
}) {
  const classes =
    variant === "warning"
      ? "bg-amber-100 text-amber-900"
      : variant === "success"
        ? "bg-emerald-100 text-emerald-900"
        : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return <p className="text-sm text-muted-foreground">{total} total</p>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} total)
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
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
