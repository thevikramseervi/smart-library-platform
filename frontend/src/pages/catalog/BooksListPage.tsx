import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import { useIsStaff } from "@/components/auth/StaffRoute";
import { appToast } from "@/lib/toast";
import { deleteBook, listBooks } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
  PaginationControls,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";

export function BooksListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["books", page, pageSize, search],
    queryFn: () => listBooks({ page, page_size: pageSize, search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      appToast.deleted("Book");
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

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

      <SearchInput value={search} onChange={setSearch} placeholder="Search books..." />

      {isLoading ? (
        <TableListSkeleton columns={isStaff ? 6 : 5} />
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load books.</p>
      ) : (
        <>
          <CatalogTable recordCount={data?.items.length}>
            <CatalogTableHead
              columns={
                isStaff
                  ? ["Title", "ISBN", "Publisher", "Copies", "Available", "Actions"]
                  : ["Title", "ISBN", "Publisher", "Copies", "Available"]
              }
            />
            <tbody>
              {data?.items.map((book) => (
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
          {data ? (
            <PaginationControls
              page={data.page}
              totalPages={data.total_pages}
              total={data.total}
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
