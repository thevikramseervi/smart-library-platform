import { BarChart3, Building2, Database, History, Shield, SlidersHorizontal, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

const navItems: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/departments", label: "Departments", icon: Building2 },
  { to: "/admin/circulation-policy", label: "Circulation Policy", icon: SlidersHorizontal },
  { to: "/admin/search-index", label: "Search Index", icon: Database },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/audit-log", label: "Audit Log", icon: History },
];

export function AdminLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-60">
        <nav aria-label="Administration sections" className="rounded-2xl border border-border/70 bg-card/75 p-2.5 shadow-sm lg:sticky lg:top-36">
          <p className="flex items-center gap-2 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            <Shield className="size-4 text-primary" aria-hidden="true" />
            Admin
          </p>
            <ul className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap lg:flex-col">
            {navItems.map((item) => (
              <li key={item.to} className="min-w-0">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-10 min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium leading-tight transition-all",
                      isActive
                        ? "bg-secondary text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
