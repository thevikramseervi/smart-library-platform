import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookRatingCard } from "@/pages/catalog/components/BookRatingCard";
import {
  fetchMyRating,
  fetchRatingSummary,
  listBookReviews,
  upsertMyReview,
} from "@/services/catalog/ratings";

vi.mock("@/services/catalog/ratings", () => ({
  deleteMyRating: vi.fn(),
  deleteMyReview: vi.fn(),
  fetchRatingSummary: vi.fn(),
  fetchMyRating: vi.fn(),
  listBookReviews: vi.fn(),
  upsertMyRating: vi.fn(),
  upsertMyReview: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  appToast: { success: vi.fn(), deleted: vi.fn() },
}));

function renderCard(allowRating = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <BookRatingCard bookId="book-1" allowRating={allowRating} />
    </QueryClientProvider>,
  );
  return queryClient;
}

const emptyReviews = {
  items: [],
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 0,
};

describe("BookRatingCard reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRatingSummary).mockResolvedValue({ book_id: "book-1", average: 4, count: 1 });
    vi.mocked(fetchMyRating).mockResolvedValue({
      book_id: "book-1",
      score: 4,
      review_text: null,
      updated_at: "2026-11-09T10:00:00Z",
    });
    vi.mocked(listBookReviews).mockResolvedValue(emptyReviews);
  });

  it("lets a rated student post a review and shows the refreshed review", async () => {
    const posted = {
      id: "review-1",
      score: 4,
      review_text: "Clear explanations and useful examples.",
      reviewer_name: "Abhishek I.",
      created_at: "2026-11-09T10:00:00Z",
      updated_at: "2026-11-09T10:00:00Z",
    };
    vi.mocked(upsertMyReview).mockImplementation(async (_bookId, reviewText) => {
      vi.mocked(listBookReviews).mockResolvedValue({
        ...emptyReviews,
        items: [{ ...posted, review_text: reviewText }],
        total: 1,
        total_pages: 1,
      });
      return {
        book_id: "book-1",
        score: 4,
        review_text: reviewText,
        updated_at: posted.updated_at,
      };
    });
    const queryClient = renderCard();
    const user = userEvent.setup();

    const reviewInput = await screen.findByLabelText(/Your written review/);
    await user.type(reviewInput, "Clear explanations and useful examples.");
    await user.click(screen.getByRole("button", { name: "Post review" }));

    await waitFor(() => {
      expect(upsertMyReview).toHaveBeenCalledWith("book-1", "Clear explanations and useful examples.");
    });
    expect(await screen.findAllByText("Clear explanations and useful examples.")).toHaveLength(2);
    expect(screen.getByText("Abhishek I.")).toBeInTheDocument();
    queryClient.clear();
  });

  it("requires a rating before offering the review editor", async () => {
    vi.mocked(fetchMyRating).mockResolvedValue(null);
    const queryClient = renderCard();

    expect(await screen.findByText("Rate this book to write a review.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Your written review/)).not.toBeInTheDocument();
    expect(await screen.findByText("No written reviews yet.")).toBeInTheDocument();
    queryClient.clear();
  });

  it("shows public reviews to staff without loading student-only rating data", async () => {
    vi.mocked(listBookReviews).mockResolvedValue({
      ...emptyReviews,
      items: [{
        id: "review-2",
        score: 5,
        review_text: "A useful reference.",
        reviewer_name: "Vikram S.",
        created_at: "2026-11-09T10:00:00Z",
        updated_at: "2026-11-09T10:00:00Z",
      }],
      total: 1,
      total_pages: 1,
    });
    const queryClient = renderCard(false);

    expect(await screen.findByText("A useful reference.")).toBeInTheDocument();
    expect(screen.queryByText("Your rating")).not.toBeInTheDocument();
    expect(fetchMyRating).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
