import { api } from "@/services/api";
import type { DepartmentCreate, DepartmentResponse, DepartmentUpdate } from "@/types/admin";

export async function listDepartments(): Promise<DepartmentResponse[]> {
  const response = await api.get<DepartmentResponse[]>("/departments");
  return response.data;
}

export async function getDepartment(id: string): Promise<DepartmentResponse> {
  const response = await api.get<DepartmentResponse>(`/departments/${id}`);
  return response.data;
}

export async function createDepartment(payload: DepartmentCreate): Promise<DepartmentResponse> {
  const response = await api.post<DepartmentResponse>("/departments", payload);
  return response.data;
}

export async function updateDepartment(
  id: string,
  payload: DepartmentUpdate,
): Promise<DepartmentResponse> {
  const response = await api.put<DepartmentResponse>(`/departments/${id}`, payload);
  return response.data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`/departments/${id}`);
}
