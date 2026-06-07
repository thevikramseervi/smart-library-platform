export interface HealthResponse {
  status: string;
  database: string;
}

export interface ApiError {
  detail: string;
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
