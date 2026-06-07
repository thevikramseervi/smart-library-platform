import { api } from "@/services/api";
import type { RoleResponse } from "@/types/admin";

export async function listRoles(): Promise<RoleResponse[]> {
  const response = await api.get<RoleResponse[]>("/roles");
  return response.data;
}
