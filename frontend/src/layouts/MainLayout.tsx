import { Link, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

export function MainLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  const showCatalogLink = Boolean(user);

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Smart Library Platform</p>
              <h1 className="text-xl font-semibold tracking-tight">Library Management</h1>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/" className="font-medium text-muted-foreground hover:text-foreground">
                Home
              </Link>
              {showCatalogLink ? (
                <Link
                  to="/catalog"
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Catalog
                </Link>
              ) : null}
            </nav>
          </div>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                <p className="font-medium">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-muted-foreground">{user.role.name}</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
