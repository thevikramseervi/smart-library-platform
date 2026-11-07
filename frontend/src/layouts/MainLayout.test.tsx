import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { MainLayout } from "@/layouts/MainLayout";
import { useAuthStore } from "@/store/authStore";

function renderAs(role: string) {
  useAuthStore.setState({
    token: "test-token",
    user: {
      id: "user-1",
      first_name: "Sam",
      last_name: "Reader",
      email: "reader@campus.edu",
      role: { id: "role-1", name: role },
      is_active: true,
    } as never,
  });

  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <MainLayout />
    </MemoryRouter>,
  );
}

describe("MainLayout navigation", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null });
  });

  it("shows the admin section only to administrators", () => {
    const { unmount } = renderAs("ADMIN");
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    unmount();

    renderAs("LIBRARIAN");
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Circulation/ })).toBeInTheDocument();
  });
});
