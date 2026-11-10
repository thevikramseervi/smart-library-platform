import type { PaginatedResponse } from "@/types/api";

export type AuditAction =
  | "BOOK_CREATED"
  | "BOOK_UPDATED"
  | "BOOK_DELETED"
  | "DIGITAL_RESOURCE_UPLOADED"
  | "DIGITAL_RESOURCE_REMOVED"
  | "COPY_CREATED"
  | "COPY_UPDATED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_PASSWORD_RESET"
  | "USER_PASSWORD_CHANGED"
  | "DEPARTMENT_CREATED"
  | "DEPARTMENT_UPDATED"
  | "DEPARTMENT_DELETED"
  | "AUTHOR_CREATED"
  | "AUTHOR_UPDATED"
  | "AUTHOR_DELETED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "CATEGORY_DELETED"
  | "PUBLISHER_CREATED"
  | "PUBLISHER_UPDATED"
  | "PUBLISHER_DELETED"
  | "LANGUAGE_CREATED"
  | "BOOK_ISSUED"
  | "BOOK_RETURNED"
  | "BOOK_RENEWED"
  | "FINE_RECORDED"
  | "FINE_PAID"
  | "CIRCULATION_POLICY_UPDATED"
  | "RESERVATION_CREATED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_EXPIRED"
  | "RESERVATION_FULFILLED";

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  actor_name: string;
  actor_email: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  summary: string;
  details: Record<string, unknown>;
  occurred_at: string;
}

export interface AuditLogParams {
  page?: number;
  page_size?: number;
  action?: AuditAction;
  q?: string;
  start_date?: string;
  end_date?: string;
}

export type AuditLogPage = PaginatedResponse<AuditLogEntry>;
