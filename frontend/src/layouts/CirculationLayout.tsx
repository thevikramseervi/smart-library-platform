import {
  AlertCircle,
  ArrowLeftRight,
  Bookmark,
  CircleDollarSign,
  ClipboardList,
  LogIn,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useIsStaff } from "@/components/auth/StaffRoute";
import { cn } from "@/lib/utils";

const staffLinks: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/circulation/issue", label: "Issue Book", icon: LogIn },
  { to: "/circulation/return", label: "Return Book", icon: LogOut },
  { to: "/circulation/loans", label: "Active Loans", icon: ClipboardList },
  { to: "/circulation/overdue", label: "Overdue Loans", icon: AlertCircle },
  { to: "/circulation/reservations", label: "Reservations", icon: Bookmark },
  { to: "/circulation/fines", label: "Fines", icon: CircleDollarSign },
];

const studentLinks: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/circulation/my-loans", label: "My Loans", icon: ClipboardList },
  { to: "/circulation/my-reservations", label: "My Reservations", icon: Bookmark },
  { to: "/circulation/my-fines", label: "My Fines", icon: CircleDollarSign },
];

export function CirculationLayout() {
  const isStaff = useIsStaff();
  const links = isStaff ? staffLinks : studentLinks;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <ArrowLeftRight className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Circulation</h1>
          <p className="text-sm text-muted-foreground">
            {isStaff
              ? "Manage library loans, returns, and reservations."
              : "View your loans, reservations, and fines."}
          </p>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 border-b pb-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <link.icon className="size-4" aria-hidden="true" />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
