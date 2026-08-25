import { api } from "@/services/api";
import type {
  Book,
  BookCreate,
  BookListParams,
  BookUpdate,
  PaginatedResponse,
  SemanticSearchResponse,
} from "@/types/catalog";

export async function listBooks(params?: BookListParams): Promise<PaginatedResponse<Book>> {
  const { search, ...rest } = params ?? {};
  const response = await api.get<PaginatedResponse<Book>>("/books", {
    params: { ...rest, q: search || undefined },
  });
  return response.data;
}

export async function semanticSearchBooks(params: {
  q: string;
  limit?: number;
}): Promise<SemanticSearchResponse> {
  const response = await api.get<SemanticSearchResponse>("/books/search", { params });
  return response.data;
}

export async function getBook(id: string): Promise<Book> {
  const response = await api.get<Book>(`/books/${id}`);
  return response.data;
}

export async function createBook(payload: BookCreate): Promise<Book> {
  const response = await api.post<Book>("/books", payload);
  return response.data;
}

export async function updateBook(id: string, payload: BookUpdate): Promise<Book> {
  const response = await api.put<Book>(`/books/${id}`, payload);
  return response.data;
}

export async function deleteBook(id: string): Promise<void> {
  await api.delete(`/books/${id}`);
}
