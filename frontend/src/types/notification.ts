export type NotificationType =
  | "BOOK_ISSUED"
  | "BOOK_RETURNED"
  | "RESERVATION_READY"
  | "DUE_SOON"
  | "LOAN_OVERDUE"
  | "FINE_RECORDED"
  | "FINE_PAID";

export interface AppNotification {
  id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationCenter {
  items: AppNotification[];
  unread_count: number;
}
