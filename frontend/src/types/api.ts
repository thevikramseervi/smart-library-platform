export interface HealthResponse {
  status: string;
  database: string;
}

export interface ApiError {
  detail: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface RoleResponse {
  id: string;
  name: string;
}

export interface DepartmentResponse {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface UserResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  student_code: string | null;
  semester: number | null;
  is_active: boolean;
  role: RoleResponse;
  department: DepartmentResponse | null;
}
