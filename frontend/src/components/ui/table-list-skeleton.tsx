import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TableListSkeletonProps {
  columns: number;
  rows?: number;
  showRecordCount?: boolean;
}

export function TableListSkeleton({
  columns,
  rows = 6,
  showRecordCount = true,
}: TableListSkeletonProps) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading table">
      {showRecordCount ? <Skeleton className="h-4 w-24" /> : null}
      <div className="overflow-hidden rounded-lg border">
        <div className="flex gap-6 border-b bg-muted/50 px-5 py-3.5">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={`head-${index}`} className="h-3.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex gap-6 border-b px-5 py-3.5 last:border-b-0"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className={cn("h-4 flex-1", colIndex === 0 && "max-w-[60%]")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
