export function formatDate(value: string): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(isDateOnly ? { timeZone: "UTC" } : {}),
  });
}

export function differenceInCalendarDays(start: string, end: string): number {
  const toUtcDay = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.floor((toUtcDay(end) - toUtcDay(start)) / 86_400_000);
}

export function getDueDateLabel(dueAt: string, today: string): string {
  const daysUntilDue = differenceInCalendarDays(today, dueAt);
  if (daysUntilDue < 0) {
    const daysOverdue = Math.abs(daysUntilDue);
    return `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;
  }
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${daysUntilDue} days`;
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
