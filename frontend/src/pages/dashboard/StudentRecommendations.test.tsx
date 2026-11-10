import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { StudentRecommendations } from "@/pages/dashboard/StudentRecommendations";
import {
  getMyRecommendations,
  saveRecommendationFeedback,
} from "@/services/recommendations";

vi.mock("@/services/recommendations", () => ({
  getMyRecommendations: vi.fn(),
  saveRecommendationFeedback: vi.fn(),
}));

function renderRecommendations() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StudentRecommendations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("StudentRecommendations", () => {
  it("shows personalized book cards and links to their detail pages", async () => {
    vi.mocked(getMyRecommendations).mockResolvedValue([{
      reason: "Because you liked Computer Science books",
      average_rating: 4.5,
      rating_count: 2,
      feedback_signal: null,
      book: {
        id: "book-1",
        title: "The Clean Coder",
        isbn: "9780137081073",
        publisher_id: "publisher-1",
        language_id: "language-1",
        edition: null,
        publication_year: 2011,
        description: null,
        cover_image_url: null,
        is_digital: false,
        publisher: { id: "publisher-1", name: "Prentice Hall", website: null, country: null, created_at: "", updated_at: "" },
        language: { id: "language-1", name: "English", code: "en", created_at: "", updated_at: "" },
        authors: [{ id: "author-1", name: "Robert C. Martin", bio: null, created_at: "", updated_at: "" }],
        categories: [{ id: "category-1", name: "Computer Science", description: null, created_at: "", updated_at: "" }],
        copy_count: 2,
        total_copies: 2,
        available_copies: 1,
        created_at: "2026-11-01T00:00:00Z",
        updated_at: "2026-11-01T00:00:00Z",
      },
    }]);
    const queryClient = renderRecommendations();

    expect(await screen.findByText("The Clean Coder")).toBeInTheDocument();
    expect(screen.getByText("Because you liked Computer Science books")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 available").closest("a")).toHaveAttribute(
      "href",
      "/catalog/books/book-1",
    );
    queryClient.clear();
  });

  it("saves explicit recommendation feedback and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyRecommendations).mockResolvedValue([{
      reason: "Popular with library readers",
      average_rating: null,
      rating_count: 0,
      feedback_signal: null,
      book: {
        id: "book-feedback",
        title: "A Useful Book",
        isbn: null,
        publisher_id: "publisher-1",
        language_id: "language-1",
        edition: null,
        publication_year: null,
        description: null,
        cover_image_url: null,
        is_digital: false,
        publisher: { id: "publisher-1", name: "Publisher", website: null, country: null, created_at: "", updated_at: "" },
        language: { id: "language-1", name: "English", code: "en", created_at: "", updated_at: "" },
        authors: [],
        categories: [],
        copy_count: 1,
        total_copies: 1,
        available_copies: 1,
        created_at: "2026-11-01T00:00:00Z",
        updated_at: "2026-11-01T00:00:00Z",
      },
    }]);
    const queryClient = renderRecommendations();

    await user.click(await screen.findByRole("button", { name: /more like this/i }));
    expect(saveRecommendationFeedback).toHaveBeenCalledWith("book-feedback", "LIKE");
    expect(await screen.findByRole("button", { name: /liked.*more like this/i })).toBeInTheDocument();
    queryClient.clear();
  });

  it("shows a useful empty state when no borrowable recommendations are available", async () => {
    vi.mocked(getMyRecommendations).mockResolvedValue([]);
    const queryClient = renderRecommendations();

    expect(await screen.findByText("No borrowable recommendations right now.")).toBeInTheDocument();
    queryClient.clear();
  });
});
