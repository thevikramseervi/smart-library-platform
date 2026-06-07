import { api } from "@/services/api";
import type {
  PaginatedResponse,
  UserCreate,
  UserListParams,
  UserPasswordReset,
  UserResponse,
  UserUpdate,
} from "@/types/admin";

export async function listUsers(params?: UserListParams): Promise<PaginatedResponse<UserResponse>> {
  const response = await api.get<PaginatedResponse<UserResponse>>("/users", { params });
  return response.data;
}

export async function getUser(id: string): Promise<UserResponse> {
  const response = await api.get<UserResponse>(`/users/${id}`);
  return response.data;
}

export async function createUser(payload: UserCreate): Promise<UserResponse> {
  const response = await api.post<UserResponse>("/users", payload);
  return response.data;
}

export async function updateUser(id: string, payload: UserUpdate): Promise<UserResponse> {
  const response = await api.put<UserResponse>(`/users/${id}`, payload);
  return response.data;
}

export async function resetUserPassword(id: string, payload: UserPasswordReset): Promise<void> {
  await api.post(`/users/${id}/reset-password`, payload);
}

export async function deactivateUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
