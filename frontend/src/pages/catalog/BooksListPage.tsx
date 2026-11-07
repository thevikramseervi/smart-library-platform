import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { useDebouncedValue } from "@/lib/hooks";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import { useIsStaff } from "@/lib/roles";
import { appToast } from "@/lib/toast";
import { deleteBook, listBooks, semanticSearchBooks } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
  PaginationControls,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";

function ScoreBadge({ score }: { score: number }) {
  const percent = Math.round(score * 100);
  return (
    <span
      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
      title="Semantic similarity"
    >
      {percent}%
    </span>
  );
}

export function BooksListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [smartSearch, setSmartSearch] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const rawSearch = search.trim();
  const trimmedSearch = useDebouncedValue(rawSearch);
  const semanticActive = smartSearch && trimmedSearch.length > 0;

  const listQuery = useQuery({
    queryKey: ["books", page, pageSize, trimmedSearch],
    queryFn: () => listBooks({ page, page_size: pageSize, search: trimmedSearch || undefined }),
    enabled: !semanticActive,
  });

  const semanticQuery = useQuery({
    queryKey: ["books", "semantic", trimmedSearch],
    queryFn: () => semanticSearchBooks({ q: trimmedSearch, limit: 50 }),
    enabled: semanticActive,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      appToast.deleted("Book");
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
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

      <div className="space-y-2">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search books..."
        />
        <label htmlFor="smart-search" className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            id="smart-search"
            type="checkbox"
            checked={smartSearch}
            onChange={(event) => {
              setSmartSearch(event.target.checked);
              setPage(1);
            }}
            className="size-4 accent-primary"
          />
          Smart search — rank by meaning (uses the semantic index when available)
        </label>
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
                  ? `Ranked by meaning across ${semanticQuery.data.indexed_books} indexed books.`
                  : "Semantic ranking is temporarily unavailable; these matches use book text."}
                {semanticQuery.data.results.length === 50
                  ? " Showing the first 50 matches."
                  : " Smart search returns up to 50 matches."}
              </p>
              <Button variant="outline" size="sm" onClick={() => setSmartSearch(false)}>
                Browse catalog pages
              </Button>
            </div>
          ) : null}
          <CatalogTable recordCount={semanticQuery.data?.results.length}>
            <CatalogTableHead columns={["Title", "Authors", "Categories", "Match"]} />
            <tbody>
              {semanticQuery.data?.results.map((result) => (
                <tr key={result.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/catalog/books/${result.id}`} className="hover:underline">
                      {result.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{result.isbn ?? ""}</span>
                  </td>
                  <td className="px-4 py-3">{result.authors.join(", ") || "—"}</td>
                  <td className="px-4 py-3">{result.categories.join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={result.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </CatalogTable>
          {semanticQuery.data && semanticQuery.data.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books matched this query.</p>
          ) : null}
        </>
      ) : (
        <>
          <CatalogTable recordCount={listQuery.data?.items.length}>
            <CatalogTableHead
              columns={
                isStaff
                  ? ["Title", "ISBN", "Publisher", "Copies", "Available", "Actions"]
                  : ["Title", "ISBN", "Publisher", "Copies", "Available"]
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
                  <td className="px-4 py-3">{book.total_copies}</td>
                  <td className="px-4 py-3">{book.available_copies}</td>
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
                          onClick={() => setPendingDelete({ id: book.id, title: book.title })}
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
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        title="Delete book?"
        description={`"${pendingDelete?.title ?? ""}" will be soft-deleted and removed from circulation.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
            setPendingDelete(null);
          }
        }}
      />
    </section>
  );
}
