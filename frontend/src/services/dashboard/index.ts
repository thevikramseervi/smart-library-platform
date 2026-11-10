import { api } from "@/services/api";
import type {
  AdminDashboardResponse,
  CirculationReportResponse,
  LibrarianDashboardResponse,
  StudentDashboardResponse,
} from "@/types/dashboard";

export async function getStudentDashboard(): Promise<StudentDashboardResponse> {
  const response = await api.get<StudentDashboardResponse>("/dashboard/student");
  return response.data;
}

export async function getLibrarianDashboard(): Promise<LibrarianDashboardResponse> {
  const response = await api.get<LibrarianDashboardResponse>("/dashboard/librarian");
  return response.data;
}

export async function getAdminDashboard(): Promise<AdminDashboardResponse> {
  const response = await api.get<AdminDashboardResponse>("/dashboard/admin");
  return response.data;
}

export async function getCirculationReport(
  startDate: string,
  endDate: string,
): Promise<CirculationReportResponse> {
  const response = await api.get<CirculationReportResponse>("/reports/circulation", {
    params: { start_date: startDate, end_date: endDate },
  });
  return response.data;
}
