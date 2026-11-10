import { api } from "@/services/api";
import type { PaginatedResponse } from "@/types/api";
import type { BookReview, MyRatingResponse, RatingSummaryResponse } from "@/types/catalog";

export async function fetchRatingSummary(bookId: string): Promise<RatingSummaryResponse> {
  const response = await api.get<RatingSummaryResponse>(`/books/${bookId}/ratings`);
  return response.data;
}

export async function fetchMyRating(bookId: string): Promise<MyRatingResponse | null> {
  const response = await api.get<MyRatingResponse | null>(`/books/${bookId}/ratings/me`);
  return response.data;
}

export async function upsertMyRating(bookId: string, score: number): Promise<MyRatingResponse> {
  const response = await api.put<MyRatingResponse>(`/books/${bookId}/rating`, { score });
  return response.data;
}

export async function deleteMyRating(bookId: string): Promise<void> {
  await api.delete(`/books/${bookId}/rating`);
}

export async function listBookReviews(
  bookId: string,
  page = 1,
): Promise<PaginatedResponse<BookReview>> {
  const response = await api.get<PaginatedResponse<BookReview>>(`/books/${bookId}/reviews`, {
    params: { page, page_size: 10 },
  });
  return response.data;
}

export async function upsertMyReview(
  bookId: string,
  reviewText: string,
): Promise<MyRatingResponse> {
  const response = await api.put<MyRatingResponse>(`/books/${bookId}/review`, {
    review_text: reviewText,
  });
  return response.data;
}

export async function deleteMyReview(bookId: string): Promise<void> {
  await api.delete(`/books/${bookId}/review`);
}
