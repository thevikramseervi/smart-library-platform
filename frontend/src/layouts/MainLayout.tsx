import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useIsAdmin } from "@/components/auth/AdminRoute";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

function formatRoleLabel(roleName: string): string {
  const normalized = roleName.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-2 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
  );

export function MainLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isAdmin = useIsAdmin();

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  const showNavLinks = Boolean(user);

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-6">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
                Smart Library Platform
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Library Management
              </h1>
            </div>
            <nav className="flex flex-wrap items-center gap-1 text-sm sm:gap-2">
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              {showNavLinks ? (
                <>
                  <NavLink to="/catalog" className={navLinkClass}>
                    Catalog
                  </NavLink>
                  <NavLink to="/circulation" className={navLinkClass}>
                    Circulation
                  </NavLink>
                  {isAdmin ? (
                    <NavLink to="/admin" className={navLinkClass}>
                      Admin
                    </NavLink>
                  ) : null}
                </>
              ) : null}
            </nav>
          </div>
          {user ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-right text-sm leading-tight">
                <p className="max-w-[10rem] truncate font-medium sm:max-w-none">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-muted-foreground">{formatRoleLabel(user.role.name)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
