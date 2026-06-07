import { isAxiosError } from "axios";

/** Extract a user-facing message from a FastAPI/Axios error response. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) {
    return fallback;
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String(item.msg);
        }
        return null;
      })
      .filter(Boolean);
    if (messages.length) {
      return messages.join(". ");
    }
  }

  return fallback;
}
