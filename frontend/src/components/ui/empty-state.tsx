import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  icon: Icon = Inbox,
  actionLabel,
  actionTo,
  onAction,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-8 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
      {!action && actionLabel && actionTo ? (
        <Button asChild variant="outline" size="sm">
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      ) : null}
      {!action && actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
