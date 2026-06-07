import { api } from "@/services/api";
import type { Language, LanguageCreate } from "@/types/catalog";

export async function listLanguages(): Promise<Language[]> {
  const response = await api.get<Language[]>("/languages");
  return response.data;
}

export async function createLanguage(payload: LanguageCreate): Promise<Language> {
  const response = await api.post<Language>("/languages", payload);
  return response.data;
}
