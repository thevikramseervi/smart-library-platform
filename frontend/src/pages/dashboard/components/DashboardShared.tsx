import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardPageHeaderProps {
  title: string;
  description: string;
}

export function DashboardPageHeader({ title, description }: DashboardPageHeaderProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

interface DashboardStatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}

export function DashboardStatCard({ label, value, hint, className }: DashboardStatCardProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

interface DashboardSectionProps {
  title: string;
  children: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export function DashboardSection({
  title,
  children,
  emptyMessage = "No activity yet.",
  isEmpty = false,
}: DashboardSectionProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : children}
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
              className="rounded-lg border bg-background p-4 transition-colors hover:bg-muted/50"
            >
              <p className="font-medium">{action.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function formatDashboardDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDashboardDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
