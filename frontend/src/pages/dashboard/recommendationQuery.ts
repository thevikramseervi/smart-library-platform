import { DASHBOARD_STALE_TIME } from "@/lib/queryClient";
import { getMyRecommendations } from "@/services/recommendations";

export const recommendationQueryOptions = {
  queryKey: ["recommendations", "me"] as const,
  queryFn: () => getMyRecommendations(20),
  staleTime: DASHBOARD_STALE_TIME,
};
