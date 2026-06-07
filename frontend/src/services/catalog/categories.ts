import { api } from "@/services/api";
import type { Category, CategoryCreate, CategoryUpdate } from "@/types/catalog";

export async function listCategories(): Promise<Category[]> {
  const response = await api.get<Category[]>("/categories");
  return response.data;
}

export async function getCategory(id: string): Promise<Category> {
  const response = await api.get<Category>(`/categories/${id}`);
  return response.data;
}

export async function createCategory(payload: CategoryCreate): Promise<Category> {
  const response = await api.post<Category>("/categories", payload);
  return response.data;
}

export async function updateCategory(id: string, payload: CategoryUpdate): Promise<Category> {
  const response = await api.put<Category>(`/categories/${id}`, payload);
  return response.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}
