import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TABLE_HEAD_CELL_CLASS =
  "px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
export const TABLE_BODY_CELL_CLASS = "px-5 py-3.5 align-middle";

interface CatalogPageHeaderProps {
  title: string;
  description?: string;
  newTo?: string;
  newLabel?: string;
}

export function CatalogPageHeader({
  title,
  description,
  newTo,
  newLabel = "Add new",
}: CatalogPageHeaderProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      actions={
        newTo ? (
          <Button asChild>
            <Link to={newTo}>{newLabel}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}

interface CatalogTableProps {
  children: ReactNode;
  recordCount?: number;
}

export function CatalogTable({ children, recordCount }: CatalogTableProps) {
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

interface CatalogTableHeadProps {
  columns: string[];
  sticky?: boolean;
}

export function CatalogTableHead({ columns, sticky = true }: CatalogTableHeadProps) {
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

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = "Search..." }: SearchInputProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

interface FormSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
}

export function FormSelect({
  id,
  label,
  value,
  onChange,
  options,
  required,
  placeholder = "Select...",
}: FormSelectProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FormTextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function FormTextarea({ id, label, value, onChange, rows = 4 }: FormTextareaProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

interface MultiSelectListProps {
  label: string;
  options: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function MultiSelectList({ label, options, selectedIds, onChange }: MultiSelectListProps) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">{label}</p>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No options available.</p>
        ) : (
          options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(option.id)}
                onChange={() => toggle(option.id)}
                className="size-4 rounded border-input"
              />
              {option.label}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
