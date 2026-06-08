import {
  BookOpen,
  Building2,
  Languages,
  PenLine,
  Tags,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

const navItems: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/catalog/books", label: "Books", icon: BookOpen },
  { to: "/catalog/authors", label: "Authors", icon: PenLine },
  { to: "/catalog/categories", label: "Categories", icon: Tags },
  { to: "/catalog/publishers", label: "Publishers", icon: Building2 },
  { to: "/catalog/languages", label: "Languages", icon: Languages },
];

export function CatalogLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <nav className="rounded-lg border bg-card p-2">
          <p className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <BookOpen className="size-3.5" aria-hidden="true" />
            Catalog
          </p>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
