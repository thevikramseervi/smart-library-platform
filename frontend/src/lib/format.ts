export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDashboardDate(value: string): string {
  return formatDate(value);
}

export function formatDashboardDateTime(value: string): string {
  const date = new Date(value);
  const datePart = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart.replace(/\s(am|pm)$/i, (_, period: string) => ` ${period.toUpperCase()}`)}`;
}

export function formatDashboardDateTimeCompact(value: string): string {
  const date = new Date(value);
  const datePart = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} · ${timePart.replace(/\s(am|pm)$/i, (_, period: string) => ` ${period.toUpperCase()}`)}`;
}
