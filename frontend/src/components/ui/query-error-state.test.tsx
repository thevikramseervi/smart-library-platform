import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryErrorState } from "@/components/ui/query-error-state";

describe("QueryErrorState", () => {
  it("retries only the request supplied by the page", () => {
    const retry = vi.fn();

    render(<QueryErrorState message="Could not load records." onRetry={retry} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load records.");
  });
});
