import { api } from "@/services/api";
import type { AuditLogPage, AuditLogParams } from "@/types/auditLog";

export async function listAuditLogs(params: AuditLogParams): Promise<AuditLogPage> {
  const response = await api.get<AuditLogPage>("/audit-logs", { params });
  return response.data;
}
