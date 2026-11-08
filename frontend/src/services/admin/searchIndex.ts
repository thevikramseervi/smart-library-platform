import { api } from "@/services/api";
import type { SearchIndexJobAccepted, SearchIndexStatus } from "@/types/searchIndex";

export async function getSearchIndexStatus(): Promise<SearchIndexStatus> {
  const response = await api.get<SearchIndexStatus>("/search-index/status");
  return response.data;
}

export async function requestSearchReindex(force: boolean): Promise<SearchIndexJobAccepted> {
  const response = await api.post<SearchIndexJobAccepted>("/search-index/reindex", { force });
  return response.data;
}
