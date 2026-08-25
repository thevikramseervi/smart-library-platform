import { api } from "@/services/api";
import type { MyRatingResponse, RatingSummaryResponse } from "@/types/catalog";

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
