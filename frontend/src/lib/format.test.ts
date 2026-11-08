import { describe, expect, it } from "vitest";

import { differenceInCalendarDays, formatDate, getDueDateLabel } from "@/lib/format";

describe("date helpers", () => {
  it("formats date-only values without shifting the calendar date", () => {
    expect(formatDate("2026-11-07")).toBe("7 Nov 2026");
  });

  it("calculates overdue duration by UTC calendar dates", () => {
    expect(differenceInCalendarDays("2026-11-06", "2026-11-07")).toBe(1);
    expect(differenceInCalendarDays("2026-11-05", "2026-11-07")).toBe(2);
  });

  it("labels loans as due soon, due today, or overdue", () => {
    expect(getDueDateLabel("2026-11-07", "2026-11-07")).toBe("Due today");
    expect(getDueDateLabel("2026-11-08", "2026-11-07")).toBe("Due tomorrow");
    expect(getDueDateLabel("2026-11-04", "2026-11-07")).toBe("Overdue by 3 days");
  });
});
