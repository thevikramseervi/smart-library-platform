import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AdminDashboardView } from "@/pages/dashboard/AdminDashboardView";
import type { AdminDashboardResponse } from "@/types/dashboard";

const dashboardData: AdminDashboardResponse = {
  users_count: 5,
  students_count: 3,
  librarians_count: 1,
  departments_count: 3,
  books_count: 167,
  active_loans: 24,
  recent_user_activity: [
    {
      activity_type: "CREATED",
      user_name: "Vikram Seervi",
      email: "student3@library.local",
      role_name: "STUDENT",
      occurred_at: "2026-06-11T12:52:00Z",
    },
  ],
  recent_circulation_activity: [
    {
      action: "ISSUE",
      book_title: "The Clean Coder",
      student_name: "Abhishek I",
      occurred_at: "2026-09-07T11:13:00Z",
    },
  ],
};

describe("AdminDashboardView", () => {
  it("shows each activity count once and names both table regions", () => {
    render(
      <MemoryRouter>
        <AdminDashboardView data={dashboardData} firstName="System" />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("1 record")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Recent user activity" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Recent circulation activity" })).toBeInTheDocument();
  });

  it("keeps the full activity timestamp available to assistive technology", () => {
    render(
      <MemoryRouter>
        <AdminDashboardView data={dashboardData} firstName="System" />
      </MemoryRouter>,
    );

    const recentUserActivity = screen.getByRole("region", { name: "Recent user activity" });
    const timestamp = within(recentUserActivity).getByText(/11 Jun/);
    expect(timestamp.closest("time")).toHaveAttribute("aria-label", expect.stringContaining("2026"));
  });
});
