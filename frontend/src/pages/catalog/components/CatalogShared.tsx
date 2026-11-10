import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const TABLE_HEAD_CELL_CLASS =
  "px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.11em] text-muted-foreground";
export const TABLE_BODY_CELL_CLASS = "px-5 py-4 align-middle";

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
  mobileContent?: ReactNode;
}

export function CatalogTable({ children, recordCount, mobileContent }: CatalogTableProps) {
  return (
    <div className="min-w-0 space-y-2">
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
          aria-label="Catalog table"
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

interface CatalogRecordCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  fields: Array<{ label: string; value: ReactNode; wide?: boolean }>;
  actions?: ReactNode;
}

export function CatalogRecordCard({ title, subtitle, fields, actions }: CatalogRecordCardProps) {
  return (
    <article className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="min-w-0">
        <h3 className="break-words text-sm font-semibold leading-snug">{title}</h3>
        {subtitle ? <div className="mt-1 break-words text-xs text-muted-foreground">{subtitle}</div> : null}
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
      {actions ? <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">{actions}</div> : null}
    </article>
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
      className="flex h-11 w-full max-w-xl rounded-xl border border-border/80 bg-card/80 px-4 py-1 text-sm shadow-sm transition-all placeholder:text-muted-foreground/75 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
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
      <Select
        value={value || (required ? undefined : "__empty__")}
        onValueChange={(nextValue) => onChange(nextValue === "__empty__" ? "" : nextValue)}
        required={required}
      >
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {!required ? <SelectItem value="__empty__">{placeholder}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
