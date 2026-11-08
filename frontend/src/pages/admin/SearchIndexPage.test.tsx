import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SearchIndexPage } from "@/pages/admin/SearchIndexPage";
import { getSearchIndexStatus, requestSearchReindex } from "@/services/admin";

vi.mock("@/services/admin", () => ({
  getSearchIndexStatus: vi.fn(),
  requestSearchReindex: vi.fn(),
}));

const status = {
  total_books: 4,
  indexed_books: 2,
  pending_books: 1,
  failed_books: 1,
  enabled: true,
  model_name: "BAAI/bge-small-en-v1.5",
  job: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><SearchIndexPage /></MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("SearchIndexPage", () => {
  beforeEach(() => {
    vi.mocked(getSearchIndexStatus).mockResolvedValue(status);
    vi.mocked(requestSearchReindex).mockResolvedValue({
      job_id: "job-1",
      status: "RUNNING",
      mode: "RETRY",
    });
  });

  it("shows indexing counts and retries pending or failed books", async () => {
    const queryClient = renderPage();

    expect(await screen.findByText("BAAI/bge-small-en-v1.5")).toBeInTheDocument();
    expect(screen.getByText("Catalog books")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry pending and failed/i }));

    await waitFor(() => expect(requestSearchReindex).toHaveBeenCalled());
    expect(vi.mocked(requestSearchReindex).mock.calls[0]?.[0]).toBe(false);
    queryClient.clear();
  });

  it("requires confirmation before requesting a full rebuild", async () => {
    const queryClient = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /rebuild entire index/i }));
    expect(await screen.findByRole("heading", { name: "Rebuild the entire search index?" })).toBeInTheDocument();
    expect(requestSearchReindex).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Rebuild index" }));

    await waitFor(() => expect(requestSearchReindex).toHaveBeenCalled());
    expect(vi.mocked(requestSearchReindex).mock.calls[0]?.[0]).toBe(true);
    queryClient.clear();
  });
});
