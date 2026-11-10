import {
  ArrowLeftRight,
  Bookmark,
  IndianRupee,
  ClipboardList,
  LogIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useIsStaff } from "@/lib/roles";
import { cn } from "@/lib/utils";

const staffLinks: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/circulation/issue", label: "Issue Book", icon: LogIn },
  { to: "/circulation/loans", label: "Loans", icon: ClipboardList },
  { to: "/circulation/reservations", label: "Reservations", icon: Bookmark },
  { to: "/circulation/fines", label: "Fines", icon: IndianRupee },
];

const studentLinks: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/circulation/my-loans", label: "My Loans", icon: ClipboardList },
  { to: "/circulation/my-reservations", label: "My Reservations", icon: Bookmark },
  { to: "/circulation/my-fines", label: "My Fines", icon: IndianRupee },
];

export function CirculationLayout() {
  const isStaff = useIsStaff();
  const links = isStaff ? staffLinks : studentLinks;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-[linear-gradient(112deg,oklch(0.93_0.045_149),oklch(0.97_0.025_94)_72%)] px-4 py-3 sm:px-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/15">
          <ArrowLeftRight className="size-4.5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Circulation</h1>
          <p className="text-sm text-muted-foreground">
            {isStaff
              ? "Manage library loans, returns, and reservations."
              : "View your loans, reservations, and fines."}
          </p>
        </div>
      </div>
      <nav aria-label="Circulation sections" className="grid grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm sm:flex sm:flex-wrap">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "inline-flex min-h-10 min-w-0 items-center justify-start gap-2 rounded-xl px-3.5 text-left text-sm font-medium leading-tight transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
