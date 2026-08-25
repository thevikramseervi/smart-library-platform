import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const trimmedSearch = search.trim();
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search books..." />
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={smartSearch}
            onChange={(event) => setSmartSearch(event.target.checked)}
            className="size-4 accent-primary"
          />
          Smart search — rank by meaning (uses the semantic index when available)
        </label>
      </div>

      {isLoading ? (
        <TableListSkeleton columns={isStaff ? 6 : 5} />
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load books.</p>
      ) : semanticActive ? (
        <>
          {semanticQuery.data && !semanticQuery.data.used_semantic ? (
            <p className="text-sm text-muted-foreground">
              Semantic index is empty; showing keyword matches instead.
            </p>
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
                          onClick={() => {
                            if (window.confirm(`Delete book "${book.title}"?`)) {
                              deleteMutation.mutate(book.id);
                            }
                          }}
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
    </section>
  );
}
