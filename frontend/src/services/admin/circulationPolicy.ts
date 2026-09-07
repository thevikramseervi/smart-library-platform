import { api } from "@/services/api";
import type { CirculationPolicyResponse, CirculationPolicyUpdate } from "@/types/circulationPolicy";

export async function getCirculationPolicy(): Promise<CirculationPolicyResponse> {
  const response = await api.get<CirculationPolicyResponse>("/circulation-policies");
  return response.data;
}

export async function updateCirculationPolicy(
  payload: CirculationPolicyUpdate,
): Promise<CirculationPolicyResponse> {
  const response = await api.put<CirculationPolicyResponse>("/circulation-policies", payload);
  return response.data;
}
