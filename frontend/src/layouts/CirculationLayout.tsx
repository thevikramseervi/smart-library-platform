import { NavLink, Outlet } from "react-router-dom";

import { useIsStaff } from "@/components/auth/StaffRoute";

const staffLinks = [
  { to: "/circulation/issue", label: "Issue Book" },
  { to: "/circulation/return", label: "Return Book" },
  { to: "/circulation/loans", label: "Active Loans" },
  { to: "/circulation/overdue", label: "Overdue Loans" },
  { to: "/circulation/reservations", label: "Reservations" },
  { to: "/circulation/fines", label: "Fines" },
];

const studentLinks = [
  { to: "/circulation/my-loans", label: "My Loans" },
  { to: "/circulation/my-reservations", label: "My Reservations" },
  { to: "/circulation/my-fines", label: "My Fines" },
];

export function CirculationLayout() {
  const isStaff = useIsStaff();
  const links = isStaff ? staffLinks : studentLinks;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Circulation</h1>
        <p className="text-sm text-muted-foreground">
          {isStaff ? "Manage library loans, returns, and reservations." : "View your loans, reservations, and fines."}
        </p>
      </div>
      <nav className="flex flex-wrap gap-2 border-b pb-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              [
                "rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
