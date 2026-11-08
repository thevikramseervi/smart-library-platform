import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BookOpen, Grid2X2, List as ListIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { useDebouncedValue } from "@/lib/hooks";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import { useIsStaff } from "@/lib/roles";
import { appToast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiError";
import type { Book, SemanticSearchResult } from "@/types/catalog";
import { deleteBook, listAuthors, listBooks, listCategories, listLanguages, listPublishers, semanticSearchBooks } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogRecordCard,
  CatalogTable,
  CatalogTableHead,
  PaginationControls,
  SearchInput,
  FormSelect,
} from "@/pages/catalog/components/CatalogShared";
import { BookCoverImage } from "@/pages/catalog/components/BookCoverImage";

const SEMANTIC_SEARCH_LIMIT = 20;

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
      aria-label={`Similarity score ${score.toFixed(3)}`}
      title="Cosine similarity score; use it to compare result order, not as a confidence percentage."
    >
      {score.toFixed(3)}
    </span>
  );
}

function BookCover({ book }: { book: Pick<Book, "title" | "cover_image_url"> }) {
  return (
    <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(145deg,oklch(0.91_0.055_149),oklch(0.96_0.025_94))] text-primary/70">
      <BookOpen className="size-10" aria-hidden="true" />
      {book.cover_image_url ? (
        <BookCoverImage
          key={book.cover_image_url}
          src={book.cover_image_url}
          title={book.title}
          className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : null}
    </div>
  );
}

function BookGridCard({
  book,
  isStaff,
  onDelete,
}: {
  book: Book;
  isStaff: boolean;
  onDelete: (book: Pick<Book, "id" | "title">) => void;
}) {
  const available = book.available_copies > 0;
  return (
    <Card className="group h-full overflow-hidden border-border/70 bg-card/90 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/[0.06]">
      <CardContent className="grid h-full grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="w-20 shrink-0 sm:w-28">
          <BookCover book={book} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span className={available
              ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900"
              : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900"}>
              {book.total_copies === 0 ? "Not in collection" : available ? "Available" : "Unavailable"}
            </span>
            {book.is_digital ? (
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900">
                Digital
              </span>
            ) : null}
          </div>
          <h2 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">
            <Link to={`/catalog/books/${book.id}`} className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {book.title}
            </Link>
          </h2>
          {book.isbn ? <p className="mt-0.5 text-xs text-muted-foreground">ISBN {book.isbn}</p> : null}
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {book.authors?.map((author) => author.name).join(", ") || "Author not listed"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {book.categories?.slice(0, 2).map((category) => (
              <span key={category.id} className="rounded-md bg-secondary/80 px-2 py-1 text-xs text-secondary-foreground">
                {category.name}
              </span>
            ))}
          </div>
          <div className="mt-auto pt-3">
            <p className="text-sm font-medium">
              <span className={available ? "text-emerald-700" : "text-muted-foreground"}>
                {book.available_copies}
              </span>
              <span className="text-muted-foreground"> available of {book.total_copies}</span>
            </p>
            {book.publisher?.name ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{book.publisher.name}</p>
            ) : null}
          </div>
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/catalog/books/${book.id}`}>
              View details <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          {isStaff ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/catalog/books/${book.id}/edit`}>Edit</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(book)}>
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SemanticResultCard({
  result,
  usedSemantic,
  isStaff,
  onDelete,
}: {
  result: SemanticSearchResult;
  usedSemantic: boolean;
  isStaff: boolean;
  onDelete: (book: Pick<Book, "id" | "title">) => void;
}) {
  const hasSimilarity = usedSemantic && result.score !== null;
  const available = result.available_copies > 0;

  return (
    <Card className="group h-full overflow-hidden border-border/70 bg-card/90 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/[0.06]">
      <CardContent className="grid h-full grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="w-20 shrink-0 sm:w-28">
          <BookCover book={result} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
            <span className={result.total_copies === 0
              ? "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              : available
                ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900"
                : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900"}>
              {result.total_copies === 0 ? "Not in collection" : available ? "Available" : "Unavailable"}
            </span>
            {hasSimilarity ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <ScoreBadge score={result.score!} />
              </div>
            ) : (
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                Text match
              </span>
            )}
          </div>
          <h2 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">
            <Link
              to={`/catalog/books/${result.id}`}
              className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {result.title}
            </Link>
          </h2>
          {result.isbn ? (
            <p className="mt-0.5 text-xs text-muted-foreground">ISBN {result.isbn}</p>
          ) : null}
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {result.authors.join(", ") || "Author not listed"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {result.categories.slice(0, 3).map((category) => (
              <span key={category} className="rounded-md bg-secondary/80 px-2 py-1 text-xs text-secondary-foreground">
                {category}
              </span>
            ))}
            {result.categories.length > 3 ? (
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                +{result.categories.length - 3}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm font-medium">
            <span className={available ? "text-emerald-700" : "text-muted-foreground"}>
              {result.available_copies}
            </span>
            <span className="text-muted-foreground"> available of {result.total_copies}</span>
          </p>
          {result.publisher ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{result.publisher}</p>
          ) : null}
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/catalog/books/${result.id}`}>
              View details <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          {isStaff ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/catalog/books/${result.id}/edit`}>Edit</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(result)}>
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function BooksListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ author_id: "", category_id: "", publisher_id: "", language_id: "", is_digital: "" });
  const [smartSearch, setSmartSearch] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const rawSearch = search.trim();
  const trimmedSearch = useDebouncedValue(rawSearch);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const semanticActive = smartSearch && !hasActiveFilters && trimmedSearch.length > 0;

  const authorsQuery = useQuery({ queryKey: ["authors"], queryFn: listAuthors });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const publishersQuery = useQuery({ queryKey: ["publishers"], queryFn: listPublishers });
  const languagesQuery = useQuery({ queryKey: ["languages"], queryFn: listLanguages });

  const listQuery = useQuery({
    queryKey: ["books", page, pageSize, trimmedSearch, filters],
    queryFn: () => listBooks({
      page, page_size: pageSize, search: trimmedSearch || undefined,
      author_id: filters.author_id || undefined,
      category_id: filters.category_id || undefined,
      publisher_id: filters.publisher_id || undefined,
      language_id: filters.language_id || undefined,
      is_digital: filters.is_digital ? filters.is_digital === "digital" : undefined,
    }),
    enabled: !semanticActive,
  });

  const semanticQuery = useQuery({
    queryKey: ["books", "semantic", trimmedSearch],
    queryFn: () => semanticSearchBooks({ q: trimmedSearch, limit: SEMANTIC_SEARCH_LIMIT }),
    enabled: semanticActive,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      appToast.deleted("Book");
      setDeleteError(null);
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (error) => setDeleteError(getApiErrorMessage(error, "Unable to delete book.")),
  });

  const isLoading = semanticActive ? semanticQuery.isLoading : listQuery.isLoading;
  const isError = semanticActive ? semanticQuery.isError : listQuery.isError;

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title="Books"
        description={
          isStaff ? "Manage catalog books and physical copies." : "Browse catalog books."
        }
        newTo={isStaff ? "/catalog/books/new" : undefined}
        newLabel="Add book"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search books..."
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-border/70 bg-card/70 p-1" aria-label="Catalog view">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
              >
                <Grid2X2 className="size-4" aria-hidden="true" />
                Cards
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              >
                <ListIcon className="size-4" aria-hidden="true" />
                List
              </Button>
          </div>
          <label htmlFor="smart-search" className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              id="smart-search"
              type="checkbox"
              checked={smartSearch}
              disabled={hasActiveFilters}
              onChange={(event) => {
                setSmartSearch(event.target.checked);
                setPage(1);
              }}
              className="size-4 accent-primary"
            />
            {hasActiveFilters ? "Clear filters to use smart search" : "Smart search"}
          </label>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:grid-cols-2 xl:grid-cols-5 [&>*]:min-w-0">
        <FormSelect id="book-author-filter" label="Author" value={filters.author_id} placeholder="All authors" options={(authorsQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => { setFilters((current) => ({ ...current, author_id: value })); setPage(1); setSmartSearch(false); }} />
        <FormSelect id="book-category-filter" label="Category" value={filters.category_id} placeholder="All categories" options={(categoriesQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => { setFilters((current) => ({ ...current, category_id: value })); setPage(1); setSmartSearch(false); }} />
        <FormSelect id="book-publisher-filter" label="Publisher" value={filters.publisher_id} placeholder="All publishers" options={(publishersQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => { setFilters((current) => ({ ...current, publisher_id: value })); setPage(1); setSmartSearch(false); }} />
        <FormSelect id="book-language-filter" label="Language" value={filters.language_id} placeholder="All languages" options={(languagesQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => { setFilters((current) => ({ ...current, language_id: value })); setPage(1); setSmartSearch(false); }} />
        <FormSelect id="book-format-filter" label="Format" value={filters.is_digital} placeholder="All formats" options={[{ value: "physical", label: "Physical" }, { value: "digital", label: "Digital" }]} onChange={(value) => { setFilters((current) => ({ ...current, is_digital: value })); setPage(1); setSmartSearch(false); }} />
      </div>

      {isLoading ? (
        <TableListSkeleton columns={isStaff ? 6 : 5} />
      ) : isError ? (
        <QueryErrorState
          message="Unable to load books."
          onRetry={() => void (semanticActive ? semanticQuery.refetch() : listQuery.refetch())}
        />
      ) : semanticActive ? (
        <>
          {semanticQuery.data ? (
            <div className="flex flex-col gap-2 rounded-xl border border-primary/15 bg-secondary/45 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                {semanticQuery.data.used_semantic
                  ? `Combines catalog text matches with meaning-based ranking across ${semanticQuery.data.indexed_books} indexed books.`
                  : "This search uses catalog text matches without semantic ranking."}
                {semanticQuery.data.used_semantic && semanticQuery.data.text_match_count > 0
                  ? ` Includes ${semanticQuery.data.text_match_count} additional text match${semanticQuery.data.text_match_count === 1 ? "" : "es"}.`
                  : ""}
                {semanticQuery.data.results.length === SEMANTIC_SEARCH_LIMIT
                  ? ` Showing the top ${SEMANTIC_SEARCH_LIMIT} matches.`
                  : ` Smart search returns up to ${SEMANTIC_SEARCH_LIMIT} matches.`}
              </p>
              <Button variant="outline" size="sm" onClick={() => setSmartSearch(false)}>
                Browse catalog pages
              </Button>
            </div>
          ) : null}
          {viewMode === "grid" ? (
            <>
              {semanticQuery.data?.results.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {semanticQuery.data.results.map((result) => (
                    <SemanticResultCard
                      key={result.id}
                      result={result}
                      usedSemantic={semanticQuery.data.used_semantic}
                      isStaff={isStaff}
                      onDelete={(item) => { setDeleteError(null); setPendingDelete({ id: item.id, title: item.title }); }}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <CatalogTable
              recordCount={semanticQuery.data?.results.length}
              mobileContent={(semanticQuery.data?.results ?? []).map((result) => (
                <CatalogRecordCard
                  key={result.id}
                  title={<Link to={`/catalog/books/${result.id}`} className="hover:underline">{result.title}</Link>}
                  subtitle={result.isbn ? `ISBN ${result.isbn}` : undefined}
                  fields={[
                    { label: "Publisher", value: result.publisher ?? "—" },
                    { label: "Available / total", value: `${result.available_copies} / ${result.total_copies}` },
                    { label: "Match", value: semanticQuery.data?.used_semantic && result.score !== null ? <ScoreBadge score={result.score} /> : "Text match" },
                  ]}
                  actions={isStaff ? <>
                    <Button variant="outline" size="sm" asChild><Link to={`/catalog/books/${result.id}/edit`}>Edit</Link></Button>
                    <Button variant="outline" size="sm" disabled={deleteMutation.isPending} onClick={() => { setDeleteError(null); setPendingDelete({ id: result.id, title: result.title }); }}>Delete</Button>
                  </> : undefined}
                />
              ))}
            >
              <CatalogTableHead columns={isStaff
                ? ["Title", "ISBN", "Publisher", "Available / Total", "Match", "Actions"]
                : ["Title", "ISBN", "Publisher", "Available / Total", "Match"]} />
              <tbody>
                {semanticQuery.data?.results.map((result) => (
                  <tr key={result.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/catalog/books/${result.id}`} className="hover:underline">
                        {result.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{result.isbn ?? "—"}</td>
                    <td className="px-4 py-3">{result.publisher ?? "—"}</td>
                    <td
                      className="px-4 py-3 tabular-nums"
                      aria-label={`${result.available_copies} available out of ${result.total_copies} total copies`}
                      title={`${result.available_copies} available out of ${result.total_copies} total copies`}
                    >
                      {result.available_copies} / {result.total_copies}
                    </td>
                    <td className="px-4 py-3">
                      {semanticQuery.data?.used_semantic && result.score !== null ? (
                        <ScoreBadge score={result.score} />
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Text match
                        </span>
                      )}
                    </td>
                    {isStaff ? (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/catalog/books/${result.id}/edit`}>Edit</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => { setDeleteError(null); setPendingDelete({ id: result.id, title: result.title }); }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </CatalogTable>
          )}
          {semanticQuery.data && semanticQuery.data.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books matched this query.</p>
          ) : null}
        </>
      ) : (
        <>
          {viewMode === "grid" ? (
            <>
              {listQuery.data?.items.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {listQuery.data.items.map((book) => (
                    <BookGridCard
                      key={book.id}
                      book={book}
                      isStaff={isStaff}
                      onDelete={(item) => { setDeleteError(null); setPendingDelete({ id: item.id, title: item.title }); }}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed bg-card/60 shadow-none">
                  <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                      <BookOpen className="size-6" aria-hidden="true" />
                    </span>
                    <p className="mt-4 font-semibold">{trimmedSearch ? "No books match your search" : "Your catalog is ready to grow"}</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      {trimmedSearch
                        ? `Try another title, author, or ISBN instead of “${trimmedSearch}”.`
                        : isStaff
                          ? "Add your first title to start building the library collection."
                          : "There are no books to display right now."}
                    </p>
                    {trimmedSearch ? (
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>
                        Clear search
                      </Button>
                    ) : isStaff ? (
                      <Button asChild size="sm" className="mt-4">
                        <Link to="/catalog/books/new">Add first book</Link>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              )}
              {listQuery.data ? (
                <PaginationControls
                  page={listQuery.data.page}
                  totalPages={listQuery.data.total_pages}
                  total={listQuery.data.total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : null}
            </>
          ) : (
          <>
          <CatalogTable
            recordCount={listQuery.data?.items.length}
            mobileContent={(listQuery.data?.items ?? []).map((book) => (
              <CatalogRecordCard
                key={book.id}
                title={<Link to={`/catalog/books/${book.id}`} className="hover:underline">{book.title}</Link>}
                subtitle={book.isbn ? `ISBN ${book.isbn}` : undefined}
                fields={[
                  { label: "Publisher", value: book.publisher?.name ?? "—" },
                  { label: "Available / total", value: `${book.available_copies} / ${book.total_copies}` },
                ]}
                actions={isStaff ? <>
                  <Button variant="outline" size="sm" asChild><Link to={`/catalog/books/${book.id}`}>View</Link></Button>
                  <Button variant="outline" size="sm" asChild><Link to={`/catalog/books/${book.id}/edit`}>Edit</Link></Button>
                  <Button variant="outline" size="sm" disabled={deleteMutation.isPending} onClick={() => { setDeleteError(null); setPendingDelete({ id: book.id, title: book.title }); }}>Delete</Button>
                </> : undefined}
              />
            ))}
          >
            <CatalogTableHead
              columns={
                isStaff
                  ? ["Title", "ISBN", "Publisher", "Available / Total", "Actions"]
                  : ["Title", "ISBN", "Publisher", "Available / Total"]
              }
            />
            <tbody>
              {listQuery.data?.items.map((book) => (
                <tr key={book.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to={`/catalog/books/${book.id}`}
                      className="hover:underline"
                    >
                      {book.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{book.isbn ?? "—"}</td>
                  <td className="px-4 py-3">{book.publisher?.name ?? "—"}</td>
                  <td
                    className="px-4 py-3 tabular-nums"
                    aria-label={`${book.available_copies} available out of ${book.total_copies} total copies`}
                    title={`${book.available_copies} available out of ${book.total_copies} total copies`}
                  >
                    {book.available_copies} / {book.total_copies}
                  </td>
                  {isStaff ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/catalog/books/${book.id}`}>View</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/catalog/books/${book.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => { setDeleteError(null); setPendingDelete({ id: book.id, title: book.title }); }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {listQuery.data?.items.length === 0 ? (
                <tr>
                  <td colSpan={isStaff ? 6 : 5} className="px-5 py-12 text-center">
                    <p className="font-semibold">No books found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {trimmedSearch
                        ? `No catalog books match “${trimmedSearch}”.`
                        : "The catalog is empty right now."}
                    </p>
                    {trimmedSearch ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setSearch("");
                          setPage(1);
                        }}
                      >
                        Clear search
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </CatalogTable>
          {listQuery.data ? (
            <PaginationControls
              page={listQuery.data.page}
              totalPages={listQuery.data.total_pages}
              total={listQuery.data.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
          </>
          )}
        </>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
        title="Delete book?"
        description={`"${pendingDelete?.title ?? ""}" will be soft-deleted and removed from circulation.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        errorMessage={deleteError}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
          }
        }}
      />
    </section>
  );
}
