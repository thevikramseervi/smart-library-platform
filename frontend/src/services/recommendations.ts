import { api } from "@/services/api";
import type { Book } from "@/types/catalog";

export interface BookRecommendation {
  book: Book;
  reason: string;
}

export async function getMyRecommendations(limit = 6): Promise<BookRecommendation[]> {
  const response = await api.get<BookRecommendation[]>("/recommendations/me", {
    params: { limit },
  });
  return response.data;
}
