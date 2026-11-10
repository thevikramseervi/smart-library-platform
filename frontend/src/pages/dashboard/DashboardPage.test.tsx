import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { getStudentDashboard } from "@/services/dashboard";
import { getMyRecommendations } from "@/services/recommendations";

vi.mock("@/services/dashboard", () => ({
  getStudentDashboard: vi.fn(),
  getLibrarianDashboard: vi.fn(),
  getAdminDashboard: vi.fn(),
}));
vi.mock("@/services/recommendations", () => ({
  getMyRecommendations: vi.fn(),
  saveRecommendationFeedback: vi.fn(),
}));
vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { first_name: "Student", role: { name: "STUDENT" } } }),
}));

describe("DashboardPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("starts recommendations while the student dashboard is still loading", async () => {
    vi.mocked(getStudentDashboard).mockImplementation(() => new Promise(() => {}));
    vi.mocked(getMyRecommendations).mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <MemoryRouter><DashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(getStudentDashboard).toHaveBeenCalledOnce();
      expect(getMyRecommendations).toHaveBeenCalledWith(20);
    });
    view.unmount();
    client.clear();
  });
});
