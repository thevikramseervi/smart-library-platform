import { cn } from "@/lib/utils";
import type { BookCopyStatus } from "@/types/catalog";

type ReservationStatus = "ACTIVE" | "FULFILLED" | "CANCELLED" | "EXPIRED";
type TransactionStatus = "ISSUED" | "RETURNED";

export type StatusBadgeVariant = "default" | "success" | "warning" | "danger" | "info";

const variantClasses: Record<StatusBadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-100 text-emerald-900",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
  info: "bg-sky-100 text-sky-900",
};

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  className?: string;
}

export function StatusBadge({ label, variant = "default", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

const bookCopyStatusMap: Record<
  BookCopyStatus,
  { label: string; variant: StatusBadgeVariant }
> = {
  AVAILABLE: { label: "Available", variant: "success" },
  BORROWED: { label: "Borrowed", variant: "info" },
  RESERVED: { label: "Reserved", variant: "warning" },
  LOST: { label: "Lost", variant: "danger" },
  DAMAGED: { label: "Damaged", variant: "danger" },
  RETIRED: { label: "Retired", variant: "default" },
};

export function BookCopyStatusBadge({ status }: { status: BookCopyStatus }) {
  const config = bookCopyStatusMap[status];
  return <StatusBadge label={config.label} variant={config.variant} />;
}

const reservationStatusMap: Record<
  ReservationStatus,
  { label: string; variant: StatusBadgeVariant }
> = {
  ACTIVE: { label: "Active", variant: "warning" },
  FULFILLED: { label: "Fulfilled", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "default" },
  EXPIRED: { label: "Expired", variant: "danger" },
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const config = reservationStatusMap[status];
  return <StatusBadge label={config.label} variant={config.variant} />;
}

export function FineStatusBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <StatusBadge label="Paid" variant="success" />
  ) : (
    <StatusBadge label="Unpaid" variant="danger" />
  );
}

export function LoanStatusBadge({
  status,
  isOverdue = false,
}: {
  status: TransactionStatus;
  isOverdue?: boolean;
}) {
  if (isOverdue) {
    return <StatusBadge label="Overdue" variant="danger" />;
  }
  if (status === "RETURNED") {
    return <StatusBadge label="Returned" variant="success" />;
  }
  return <StatusBadge label="On loan" variant="info" />;
}

export function CirculationActionBadge({ action }: { action: "ISSUE" | "RETURN" }) {
  return action === "RETURN" ? (
    <StatusBadge label="Return" variant="success" />
  ) : (
    <StatusBadge label="Issue" variant="info" />
  );
}

export function UserActivityBadge({ activityType }: { activityType: "CREATED" | "DEACTIVATED" }) {
  return activityType === "CREATED" ? (
    <StatusBadge label="Created" variant="success" />
  ) : (
    <StatusBadge label="Deactivated" variant="warning" />
  );
}

type UserRoleName = "ADMIN" | "LIBRARIAN" | "STUDENT";

const roleBadgeMap: Record<UserRoleName, StatusBadgeVariant> = {
  ADMIN: "danger",
  LIBRARIAN: "info",
  STUDENT: "success",
};

export function RoleBadge({ role }: { role: string }) {
  const normalized = role.toUpperCase() as UserRoleName;
  const variant = roleBadgeMap[normalized] ?? "default";
  return <StatusBadge label={normalized} variant={variant} />;
}
