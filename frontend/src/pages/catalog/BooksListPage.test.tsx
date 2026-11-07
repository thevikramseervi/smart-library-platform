import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BooksListPage } from "@/pages/catalog/BooksListPage";
import { listBooks } from "@/services/catalog";

vi.mock("@/services/catalog", () => ({
  deleteBook: vi.fn(),
  listBooks: vi.fn(),
  semanticSearchBooks: vi.fn(),
}));

describe("BooksListPage", () => {
  beforeEach(() => {
    vi.mocked(listBooks).mockImplementation(async (params) => {
      const page = params?.page ?? 1;
      const search = params?.search;
      return {
        items: [
          {
            id: `book-${page}-${search ?? "all"}`,
            title: search ? `Match for ${search}` : `Page ${page} book`,
            isbn: null,
            publisher: { name: "Library Press" },
            total_copies: 1,
            available_copies: 1,
          },
        ],
        total: search ? 1 : 21,
        page,
        page_size: 20,
        total_pages: search ? 1 : 2,
      } as never;
    });
  });

  it("returns to page one before applying a new catalog search", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BooksListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("link", { name: "Page 1 book" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("link", { name: "Page 2 book" });

    fireEvent.change(screen.getByPlaceholderText("Search books..."), {
      target: { value: "Ada" },
    });

    await screen.findByRole("link", { name: "Match for Ada" }, { timeout: 2000 });
    await waitFor(() => {
      expect(listBooks).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
        search: "Ada",
      });
    });

    queryClient.clear();
  });
});
