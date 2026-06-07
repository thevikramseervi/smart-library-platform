import { api } from "@/services/api";
import type { Publisher, PublisherCreate, PublisherUpdate } from "@/types/catalog";

export async function listPublishers(): Promise<Publisher[]> {
  const response = await api.get<Publisher[]>("/publishers");
  return response.data;
}

export async function getPublisher(id: string): Promise<Publisher> {
  const response = await api.get<Publisher>(`/publishers/${id}`);
  return response.data;
}

export async function createPublisher(payload: PublisherCreate): Promise<Publisher> {
  const response = await api.post<Publisher>("/publishers", payload);
  return response.data;
}

export async function updatePublisher(id: string, payload: PublisherUpdate): Promise<Publisher> {
  const response = await api.put<Publisher>(`/publishers/${id}`, payload);
  return response.data;
}

export async function deletePublisher(id: string): Promise<void> {
  await api.delete(`/publishers/${id}`);
}
