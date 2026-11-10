import { api } from "@/services/api";
import type { Book } from "@/types/catalog";

export interface BookRecommendation {
  book: Book;
  reason: string;
  average_rating: number | null;
  rating_count: number;
  feedback_signal: RecommendationFeedbackSignal | null;
}

export type RecommendationFeedbackSignal = "LIKE" | "DISMISS";

export async function getMyRecommendations(limit = 9): Promise<BookRecommendation[]> {
  const response = await api.get<BookRecommendation[]>("/recommendations/me", {
    params: { limit },
  });
  return response.data;
}

export async function saveRecommendationFeedback(
  bookId: string,
  signal: RecommendationFeedbackSignal,
): Promise<void> {
  await api.put(`/recommendations/${bookId}/feedback`, { signal });
}

export async function clearRecommendationFeedback(bookId: string): Promise<void> {
  await api.delete(`/recommendations/${bookId}/feedback`);
}
