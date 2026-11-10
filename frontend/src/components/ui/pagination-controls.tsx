import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationControlsProps) {
  const showPageNav = totalPages > 1;

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-sm text-muted-foreground">
        {showPageNav ? (
          <>
            Page {page} of {totalPages} · {total} record{total === 1 ? "" : "s"}
          </>
        ) : (
          <>
            {total} record{total === 1 ? "" : "s"}
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {pageSize != null && onPageSizeChange ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Per page</span>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger aria-label="Per page" className="h-8 w-20 px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {showPageNav ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
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
        ) : null}
      </div>
    </div>
  );
}
