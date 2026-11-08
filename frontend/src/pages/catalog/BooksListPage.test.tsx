import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BooksListPage } from "@/pages/catalog/BooksListPage";
import { listBooks, semanticSearchBooks } from "@/services/catalog";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/services/catalog", () => ({
  deleteBook: vi.fn(),
  listAuthors: vi.fn().mockResolvedValue([]),
  listBooks: vi.fn(),
  listCategories: vi.fn().mockResolvedValue([]),
  listLanguages: vi.fn().mockResolvedValue([]),
  listPublishers: vi.fn().mockResolvedValue([]),
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
            isbn: "9781234567890",
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
    expect(screen.getByText("ISBN 9781234567890")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("link", { name: "Page 2 book" });

    fireEvent.change(screen.getByPlaceholderText("Search books..."), {
      target: { value: "Ada" },
    });

    await screen.findByRole("link", { name: "Match for Ada" }, { timeout: 2000 });
    await waitFor(() => {
      expect(listBooks).toHaveBeenLastCalledWith(expect.objectContaining({
        page: 1,
        page_size: 20,
        search: "Ada",
      }));
    });

    queryClient.clear();
  });

  it("does not present keyword fallback hits as semantic similarity scores", async () => {
    vi.mocked(semanticSearchBooks).mockResolvedValue({
      query: "books about language models",
      indexed_books: 20,
      used_semantic: false,
      text_match_count: 1,
      results: [{
        id: "fallback-book",
        title: "Language Models",
        cover_image_url: null,
        publisher: null,
        isbn: null,
        publication_year: null,
        authors: [],
        categories: [],
        total_copies: 0,
        available_copies: 0,
        score: null,
      }],
    });
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

    fireEvent.change(screen.getByPlaceholderText("Search books..."), {
      target: { value: "books about language models" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Smart search/ }));

    await screen.findByRole("link", { name: "Language Models" });
    expect(screen.getByText("Text match")).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    queryClient.clear();
  });

  it("shows text matches alongside semantic results when indexing is partial", async () => {
    vi.mocked(semanticSearchBooks).mockResolvedValue({
      query: "books about language models",
      indexed_books: 20,
      used_semantic: true,
      text_match_count: 1,
      results: [
        {
          id: "semantic-book",
          title: "Neural Language Systems",
          cover_image_url: null,
          publisher: null,
          isbn: null,
          publication_year: null,
          authors: [],
          categories: [],
          total_copies: 0,
          available_copies: 0,
          score: 0.82,
        },
        {
          id: "text-book",
          title: "Language Models",
          cover_image_url: null,
          publisher: null,
          isbn: null,
          publication_year: null,
          authors: [],
          categories: [],
          total_copies: 0,
          available_copies: 0,
          score: null,
        },
      ],
    });
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

    fireEvent.change(screen.getByPlaceholderText("Search books..."), {
      target: { value: "books about language models" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Smart search/ }));

    await screen.findByRole("link", { name: "Neural Language Systems" });
    expect(screen.getByRole("link", { name: "Language Models" })).toBeInTheDocument();
    expect(screen.getByText("0.820")).toBeInTheDocument();
    expect(screen.queryByText("82%")).not.toBeInTheDocument();
    expect(screen.getByText("Text match")).toBeInTheDocument();
    expect(screen.getByText(/Combines catalog text matches with meaning-based ranking/)).toBeInTheDocument();
    expect(screen.getByText(/Includes 1 additional text match/)).toBeInTheDocument();
    queryClient.clear();
  });

  it("lets students switch semantic search results between cards and list", async () => {
    vi.mocked(semanticSearchBooks).mockResolvedValue({
      query: "database design",
      indexed_books: 20,
      used_semantic: true,
      text_match_count: 0,
      results: [{
        id: "semantic-card-book",
        title: "Practical Database Design",
        cover_image_url: "https://covers.example.test/database-design.jpg",
        publisher: "Campus Press",
        isbn: "9781234567890",
        publication_year: 2024,
        authors: ["A. Author"],
        categories: ["Databases", "Software Engineering"],
        total_copies: 5,
        available_copies: 2,
        score: 0.84,
      }],
    });
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

    fireEvent.change(screen.getByPlaceholderText("Search books..."), {
      target: { value: "database design" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Smart search/ }));

    expect(await screen.findByRole("link", { name: "Practical Database Design" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cover of Practical Database Design" })).toHaveAttribute(
      "src",
      "https://covers.example.test/database-design.jpg",
    );
    expect(screen.getByText("ISBN 9781234567890")).toBeInTheDocument();
    expect(screen.getByText("A. Author")).toBeInTheDocument();
    expect(screen.getByText("Campus Press")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("available of 5")).toBeInTheDocument();
    expect(screen.getByText("Databases")).toBeInTheDocument();
    expect(screen.getByText("0.840")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /List/ }));
    expect(screen.getByRole("columnheader", { name: "ISBN" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Available / Total" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Match" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Authors" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Categories" })).not.toBeInTheDocument();
    expect(screen.getByText("9781234567890")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toHaveAttribute(
      "aria-label",
      "2 available out of 5 total copies",
    );
    fireEvent.click(screen.getByRole("button", { name: /Cards/ }));
    expect(screen.getByText("0.840")).toBeInTheDocument();

    queryClient.clear();
  });

  it("keeps staff book management actions in semantic search", async () => {
    const previousUser = useAuthStore.getState().user;
    useAuthStore.setState({
      user: {
        id: "librarian-1",
        email: "librarian@example.test",
        first_name: "Dev",
        last_name: "Librarian",
        phone: null,
        student_code: null,
        semester: null,
        is_active: true,
        role: { id: "role-librarian", name: "LIBRARIAN" },
        department: null,
      },
    });
    vi.mocked(semanticSearchBooks).mockResolvedValue({
      query: "library science",
      indexed_books: 20,
      used_semantic: true,
      text_match_count: 0,
      results: [{
        id: "staff-semantic-book",
        title: "Library Science Handbook",
        cover_image_url: null,
        publisher: "Campus Press",
        isbn: null,
        publication_year: 2024,
        authors: ["A. Author"],
        categories: [],
        total_copies: 2,
        available_copies: 1,
        score: 0.8,
      }],
    });
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
    fireEvent.change(screen.getByPlaceholderText("Search books..."), {
      target: { value: "library science" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Smart search/ }));

    expect(await screen.findByRole("link", { name: "Library Science Handbook" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/catalog/books/staff-semantic-book/edit",
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("heading", { name: "Delete book?" })).toBeInTheDocument();

    useAuthStore.setState({ user: previousUser });
    queryClient.clear();
  });
});
