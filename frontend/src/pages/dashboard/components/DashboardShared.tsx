import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardWelcomeHeaderProps {
  firstName: string;
  subtitle: string;
}

export function DashboardWelcomeHeader({ firstName, subtitle }: DashboardWelcomeHeaderProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/** @deprecated Use DashboardWelcomeHeader instead. */
export function DashboardPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

type StatTone = "default" | "success" | "warning" | "danger";

interface DashboardStatCardProps {
  label: string;
  value: ReactNode;
  description?: string;
  tone?: StatTone;
  className?: string;
}

const statToneClasses: Record<StatTone, string> = {
  default: "",
  success: "border-emerald-200/80",
  warning: "border-amber-200/80",
  danger: "border-destructive/30",
};

const statValueToneClasses: Record<StatTone, string> = {
  default: "",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-destructive",
};

export function DashboardStatCard({
  label,
  value,
  description,
  tone = "default",
  className,
}: DashboardStatCardProps) {
  return (
    <Card className={cn("shadow-sm", statToneClasses[tone], className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={cn("text-2xl font-semibold tracking-tight", statValueToneClasses[tone])}>
          {value}
        </p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}

interface DashboardEmptyStateProps {
  message: string;
  actionLabel?: string;
  actionTo?: string;
}

export function DashboardEmptyState({ message, actionLabel, actionTo }: DashboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && actionTo ? (
        <Button asChild variant="outline" size="sm">
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

interface DashboardSectionProps {
  title: string;
  children: ReactNode;
  emptyMessage?: string;
  emptyActionLabel?: string;
  emptyActionTo?: string;
  isEmpty?: boolean;
  compact?: boolean;
}

export function DashboardSection({
  title,
  children,
  emptyMessage = "No activity yet.",
  emptyActionLabel,
  emptyActionTo,
  isEmpty = false,
  compact = false,
}: DashboardSectionProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <DashboardEmptyState
            message={emptyMessage}
            actionLabel={emptyActionLabel}
            actionTo={emptyActionTo}
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group flex cursor-pointer items-start justify-between gap-3 rounded-lg border bg-background p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div>
                <p className="font-medium">{action.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
              </div>
              <ArrowRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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
