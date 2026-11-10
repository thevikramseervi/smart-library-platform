import { api } from "@/services/api";

export interface DigitalResource {
  id: string;
  book_id: string;
  original_filename: string;
  file_size: number;
  created_at: string;
}

export async function getDigitalResource(bookId: string): Promise<DigitalResource | null> {
  const response = await api.get<DigitalResource | null>(`/digital-resources/books/${bookId}`);
  return response.data;
}

export async function uploadDigitalResource(bookId: string, file: File): Promise<DigitalResource> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.put<DigitalResource>(
    `/digital-resources/books/${bookId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function removeDigitalResource(bookId: string): Promise<void> {
  await api.delete(`/digital-resources/books/${bookId}`);
}

export async function getDigitalResourceContent(bookId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/digital-resources/books/${bookId}/content`, {
    responseType: "blob",
  });
  return response.data;
}
