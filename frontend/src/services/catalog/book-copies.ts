import { api } from "@/services/api";
import type { BookCopy, BookCopyCreate, BookCopyUpdate } from "@/types/catalog";

export interface BookCopyListParams {
  book_id?: string;
  status?: BookCopy["status"];
}

export async function listBookCopies(params?: BookCopyListParams): Promise<BookCopy[]> {
  const response = await api.get<BookCopy[]>("/book-copies", { params });
  return response.data;
}

export async function getBookCopy(id: string): Promise<BookCopy> {
  const response = await api.get<BookCopy>(`/book-copies/${id}`);
  return response.data;
}

export async function createBookCopy(payload: BookCopyCreate): Promise<BookCopy> {
  const response = await api.post<BookCopy>("/book-copies", payload);
  return response.data;
}

export async function updateBookCopy(id: string, payload: BookCopyUpdate): Promise<BookCopy> {
  const response = await api.put<BookCopy>(`/book-copies/${id}`, payload);
  return response.data;
}

export async function getBookCopyQr(id: string): Promise<Blob> {
  const response = await api.get<Blob>(`/book-copies/${id}/qr`, {
    responseType: "blob",
  });
  return response.data;
}
