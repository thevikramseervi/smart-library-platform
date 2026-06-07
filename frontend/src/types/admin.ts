import type { DepartmentResponse, PaginatedResponse, RoleResponse, UserResponse } from "@/types/api";

export interface DepartmentCreate {
  name: string;
  code: string;
  description?: string | null;
}

export interface DepartmentUpdate {
  name?: string;
  code?: string;
  description?: string | null;
}

export interface UserCreate {
  role_id: string;
  department_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  password: string;
  student_code?: string | null;
  semester?: number | null;
  is_active?: boolean;
}

export interface UserUpdate {
  role_id?: string;
  department_id?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  password?: string;
  student_code?: string | null;
  semester?: number | null;
  is_active?: boolean;
}

export interface UserPasswordReset {
  password: string;
}

export interface UserListParams {
  page?: number;
  page_size?: number;
  q?: string;
  role?: RoleResponse["name"];
  department_id?: string;
  is_active?: boolean;
}

export type { DepartmentResponse, PaginatedResponse, RoleResponse, UserResponse };
