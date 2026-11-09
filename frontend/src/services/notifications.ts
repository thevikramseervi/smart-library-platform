import { api } from "@/services/api";
import type { AppNotification, NotificationCenter } from "@/types/notification";

export async function listNotifications(): Promise<NotificationCenter> {
  const response = await api.get<NotificationCenter>("/notifications");
  return response.data;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const response = await api.post<AppNotification>(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all");
}
