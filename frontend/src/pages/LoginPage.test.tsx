import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/pages/LoginPage";
import { getCurrentUser, login } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/services/auth", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null });
    vi.mocked(login).mockResolvedValue({ access_token: "access-token" } as never);
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("Profile lookup failed"));
  });

  it("does not persist a token or redirect when loading the user profile fails", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reader@campus.edu" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in");
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledWith("access-token"));
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();

    queryClient.clear();
  });

  it("stores the complete auth session and opens the dashboard after login", async () => {
    const user = {
      id: "student-1",
      first_name: "Sam",
      last_name: "Reader",
      email: "reader@campus.edu",
      role: { id: "role-student", name: "STUDENT" },
      is_active: true,
    };
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard home</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reader@campus.edu" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({ token: "access-token", user });
    expect(getCurrentUser).toHaveBeenCalledWith("access-token");

    queryClient.clear();
  });
});
