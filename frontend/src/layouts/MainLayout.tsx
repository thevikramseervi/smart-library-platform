import {
  ArrowLeftRight,
  BookOpen,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Shield,
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/status-badge";
import { useIsAdmin } from "@/lib/roles";
import { logout } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const mainNavItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/catalog", label: "Catalog", icon: BookOpen },
  { to: "/circulation", label: "Circulation", icon: ArrowLeftRight },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

export function MainLayout() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = useIsAdmin();
  const initials = user ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}` : "";

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-7 lg:px-10">
          <Link to="/dashboard" className="group flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15 transition-transform group-hover:-rotate-3">
              <LibraryBig className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold tracking-tight text-foreground sm:text-base">
                Smart Library
              </span>
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
                Campus knowledge hub
              </span>
            </span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2.5 rounded-2xl border border-border/70 bg-card/80 py-1.5 pr-3 pl-1.5 sm:flex">
                <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-xs font-bold uppercase text-primary">
                  {initials}
                </span>
                <span className="max-w-40">
                  <span className="block truncate text-sm font-semibold leading-tight">
                    {user.first_name} {user.last_name}
                  </span>
                  <RoleBadge role={user.role.name} />
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                aria-label="Log out"
                className="size-10 rounded-xl px-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:px-3"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          ) : (
            <span className="rounded-full border border-primary/15 bg-secondary/70 px-3 py-1.5 text-xs font-semibold text-primary">
              Library portal
            </span>
          )}
        </div>

        {user ? (
          <div className="mx-auto max-w-[1440px] px-3 pb-3 sm:px-7 lg:px-10">
            <nav aria-label="Main navigation" className="flex min-w-0 flex-wrap gap-1 rounded-2xl border border-border/60 bg-card/70 p-1.5 shadow-sm shadow-foreground/[0.025]">
              {mainNavItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
              {isAdmin ? (
                <NavLink to="/admin" className={navLinkClass}>
                  <Shield className="size-4" aria-hidden="true" />
                  Admin
                </NavLink>
              ) : null}
            </nav>
          </div>
        ) : null}
      </header>

      <main className="mx-auto min-h-[calc(100svh-5rem)] max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-11">
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-[1440px] items-center justify-between px-4 pb-6 text-xs text-muted-foreground/80 sm:px-7 lg:px-10">
        <span>Smart Library Platform</span>
        <span className="hidden sm:inline">A little more room for curiosity.</span>
      </footer>
    </div>
  );
}
