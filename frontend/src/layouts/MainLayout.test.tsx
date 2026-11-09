import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MainLayout } from "@/layouts/MainLayout";
import { listNotifications } from "@/services/notifications";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/services/notifications", () => ({
  listNotifications: vi.fn().mockResolvedValue({ items: [], unread_count: 0 }),
}));

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

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MainLayout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MainLayout navigation", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null });
    vi.mocked(listNotifications).mockResolvedValue({ items: [], unread_count: 0 });
  });

  it("shows the admin section only to administrators", () => {
    const { unmount } = renderAs("ADMIN");
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    unmount();

    renderAs("LIBRARIAN");
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Circulation/ })).toBeInTheDocument();
  });

  it("shows a notifications link to every authenticated role", () => {
    renderAs("STUDENT");
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/notifications",
    );
  });

  it("shows the unread notification count in the header", async () => {
    vi.mocked(listNotifications).mockResolvedValue({ items: [], unread_count: 3 });
    renderAs("STUDENT");

    expect(await screen.findByRole("link", { name: "Notifications, 3 unread" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
