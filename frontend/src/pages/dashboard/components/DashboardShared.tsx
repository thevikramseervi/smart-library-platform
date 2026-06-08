import {
  ArrowRight,
  BookMarked,
  BookOpen,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const DASHBOARD_TABLE_CELL_CLASS = "px-5 py-3.5 align-middle";

interface DashboardWelcomeHeaderProps {
  firstName: string;
  subtitle: string;
}

export function DashboardWelcomeHeader({ firstName, subtitle }: DashboardWelcomeHeaderProps) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <LayoutDashboard className="size-4 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-0.5">
        <h2 className="text-xl font-semibold tracking-tight">Welcome back, {firstName}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

type StatTone = "default" | "success" | "warning" | "danger";
type StatAccent = "blue" | "green" | "purple" | "amber" | "indigo" | "sky" | "slate";

interface DashboardStatCardProps {
  label: string;
  value: ReactNode;
  description?: string;
  tone?: StatTone;
  accent?: StatAccent;
  icon?: LucideIcon;
  to?: string;
  className?: string;
}

const statAccentIconClasses: Record<StatAccent, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  purple: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  indigo: "bg-indigo-50 text-indigo-600",
  sky: "bg-sky-50 text-sky-600",
  slate: "bg-muted text-muted-foreground",
};

const statValueToneClasses: Record<StatTone, string> = {
  default: "text-foreground",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-destructive",
};

const statIconToneClasses: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-destructive",
};

export function DashboardStatCard({
  label,
  value,
  description,
  tone = "default",
  accent = "slate",
  icon: Icon = BookOpen,
  to,
  className,
}: DashboardStatCardProps) {
  const iconClass =
    tone !== "default" ? statIconToneClasses[tone] : statAccentIconClasses[accent];

  const card = (
    <Card
      className={cn(
        "h-full gap-0 border bg-card py-0 shadow-sm transition-[box-shadow,border-color]",
        to && "hover:border-foreground/15 hover:shadow-md",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3.5">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            iconClass,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="space-y-0.5 px-4 pb-3.5 pt-0">
        <p className={cn("text-2xl font-semibold leading-none tracking-tight", statValueToneClasses[tone])}>
          {value}
        </p>
        {description ? (
          <p className="text-xs leading-snug text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${label}: ${typeof value === "string" || typeof value === "number" ? value : "view details"}`}
      >
        {card}
      </Link>
    );
  }

  return card;
}

export function DashboardStatCardSkeleton() {
  return (
    <Card className="h-full gap-0 border bg-card py-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-8 rounded-md" />
      </CardHeader>
      <CardContent className="space-y-0.5 px-4 pb-3.5 pt-0">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export function DashboardSectionSkeleton({ rows = 4, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-16" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-20" />
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
                <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardLoadingSkeletonProps {
  statCount: number;
  statGridClassName?: string;
  sectionCount?: number;
  showQuickActions?: boolean;
}

export function DashboardLoadingSkeleton({
  statCount,
  statGridClassName = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
  sectionCount = 2,
  showQuickActions = true,
}: DashboardLoadingSkeletonProps) {
  return (
    <section className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>

      <div className={statGridClassName}>
        {Array.from({ length: statCount }).map((_, index) => (
          <DashboardStatCardSkeleton key={`stat-${index}`} />
        ))}
      </div>

      {sectionCount > 0 ? (
        <div
          className={cn(
            "grid gap-6",
            sectionCount > 1 ? "xl:grid-cols-2" : "grid-cols-1",
          )}
        >
          {Array.from({ length: sectionCount }).map((_, index) => (
            <DashboardSectionSkeleton key={`section-${index}`} />
          ))}
        </div>
      ) : null}

      {showQuickActions ? (
        <Card className="shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`action-${index}`} className="h-24 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

interface DashboardEmptyStateProps {
  message: string;
  actionLabel?: string;
  actionTo?: string;
  icon?: LucideIcon;
}

export function DashboardEmptyState({
  message,
  actionLabel,
  actionTo,
  icon,
}: DashboardEmptyStateProps) {
  return (
    <EmptyState
      message={message}
      icon={icon}
      actionLabel={actionLabel}
      actionTo={actionTo}
      className="items-start py-4 text-left"
    />
  );
}

interface DashboardSectionProps {
  title: string;
  children: ReactNode;
  emptyMessage?: string;
  emptyActionLabel?: string;
  emptyActionTo?: string;
  emptyIcon?: LucideIcon;
  isEmpty?: boolean;
  compact?: boolean;
  recordCount?: number;
}

export function DashboardSection({
  title,
  children,
  emptyMessage = "No activity yet.",
  emptyActionLabel,
  emptyActionTo,
  emptyIcon,
  isEmpty = false,
  compact = false,
  recordCount,
}: DashboardSectionProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {!isEmpty && recordCount != null ? (
          <span className="text-xs text-muted-foreground">
            {recordCount} record{recordCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <DashboardEmptyState
            message={emptyMessage}
            actionLabel={emptyActionLabel}
            actionTo={emptyActionTo}
            icon={emptyIcon}
          />
        ) : (
          <div className={cn(compact && "max-h-64 overflow-y-auto")}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickAction {
  to: string;
  label: string;
  description: string;
  icon?: LucideIcon;
}

interface DashboardQuickActionsProps {
  title?: string;
  actions: QuickAction[];
}

export function DashboardQuickActions({
  title = "Quick actions",
  actions,
}: DashboardQuickActionsProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon ?? ClipboardList;
            return (
              <Link
                key={action.to}
                to={action.to}
                className="group flex cursor-pointer items-start justify-between gap-3 rounded-lg border bg-background p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted group-hover:bg-primary/10">
                    <Icon
                      className="size-4 text-muted-foreground group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="font-medium">{action.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <ArrowRight
                  className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export { BookMarked, BookOpen, CircleDollarSign, ClipboardList };

export function formatDashboardDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDashboardDateTime(value: string): string {
  const date = new Date(value);
  const datePart = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart.replace(/\s(am|pm)$/i, (_, period) => ` ${period.toUpperCase()}`)}`;
}
