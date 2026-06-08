import { toast } from "sonner";

export const appToast = {
  created: (entity: string) => toast.success(`${entity} created successfully`),
  updated: (entity: string) => toast.success(`${entity} updated successfully`),
  deleted: (entity: string) => toast.success(`${entity} deleted successfully`),
  issued: (detail?: string) => toast.success(detail ?? "Book issued successfully"),
  returned: (detail?: string) => toast.success(detail ?? "Book returned successfully"),
  reserved: (detail?: string) => toast.success(detail ?? "Reservation created successfully"),
  cancelled: (detail?: string) => toast.success(detail ?? "Reservation cancelled successfully"),
  paid: (detail?: string) => toast.success(detail ?? "Fine marked as paid"),
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
};
