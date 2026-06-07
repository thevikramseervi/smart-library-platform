import { api } from "@/services/api";
import type { Author, AuthorCreate, AuthorUpdate } from "@/types/catalog";

export async function listAuthors(): Promise<Author[]> {
  const response = await api.get<Author[]>("/authors");
  return response.data;
}

export async function getAuthor(id: string): Promise<Author> {
  const response = await api.get<Author>(`/authors/${id}`);
  return response.data;
}

export async function createAuthor(payload: AuthorCreate): Promise<Author> {
  const response = await api.post<Author>("/authors", payload);
  return response.data;
}

export async function updateAuthor(id: string, payload: AuthorUpdate): Promise<Author> {
  const response = await api.put<Author>(`/authors/${id}`, payload);
  return response.data;
}

export async function deleteAuthor(id: string): Promise<void> {
  await api.delete(`/authors/${id}`);
}
