import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useIsStaff } from "@/components/auth/StaffRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBookCopy, getBook, listBookCopies } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
} from "@/pages/catalog/components/CatalogShared";

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();
  const [inventoryCode, setInventoryCode] = useState("");
  const [location, setLocation] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);

  const bookQuery = useQuery({
    queryKey: ["books", id],
    queryFn: () => getBook(id!),
    enabled: Boolean(id),
  });

  const copiesQuery = useQuery({
    queryKey: ["book-copies", id],
    queryFn: () => listBookCopies({ book_id: id }),
    enabled: Boolean(id),
  });

  const createCopyMutation = useMutation({
    mutationFn: () =>
      createBookCopy({
        book_id: id!,
        inventory_code: inventoryCode,
        location: location || null,
      }),
    onSuccess: () => {
      setInventoryCode("");
      setLocation("");
      setCopyError(null);
      queryClient.invalidateQueries({ queryKey: ["book-copies", id] });
      queryClient.invalidateQueries({ queryKey: ["books", id] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (error) => {
      if (isAxiosError(error) && typeof error.response?.data?.detail === "string") {
        setCopyError(error.response.data.detail);
        return;
      }
      setCopyError("Unable to add copy.");
    },
  });

  if (bookQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading book...</p>;
  }

  if (bookQuery.isError || !bookQuery.data) {
    return <p className="text-sm text-destructive">Unable to load book.</p>;
  }

  const book = bookQuery.data;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <CatalogPageHeader
          title={book.title}
          description={`${book.total_copies} copies · ${book.available_copies} available`}
        />
        <div className="flex gap-2">
          {isStaff ? (
            <Button variant="outline" asChild>
              <Link to={`/catalog/books/${book.id}/edit`}>Edit book</Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link to="/catalog/books">Back to books</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Book information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">ISBN</dt>
              <dd className="mt-1">{book.isbn ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Edition</dt>
              <dd className="mt-1">{book.edition ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Publisher</dt>
              <dd className="mt-1">{book.publisher?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Language</dt>
              <dd className="mt-1">
                {book.language ? `${book.language.name} (${book.language.code})` : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Publication year</dt>
              <dd className="mt-1">{book.publication_year ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Digital</dt>
              <dd className="mt-1">{book.is_digital ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Authors</dt>
              <dd className="mt-1">
                {book.authors?.length
                  ? book.authors.map((author) => author.name).join(", ")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Categories</dt>
              <dd className="mt-1">
                {book.categories?.length
                  ? book.categories.map((category) => category.name).join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-muted-foreground">Description</dt>
              <dd className="mt-1">{book.description ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Copy count</dt>
              <dd className="mt-1">{book.copy_count}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Total / Available</dt>
              <dd className="mt-1">
                {book.total_copies} / {book.available_copies}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Physical copies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isStaff ? (
            <form
              className="grid gap-4 sm:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                setCopyError(null);
                createCopyMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="copy-inventory-code">Inventory code</Label>
                <Input
                  id="copy-inventory-code"
                  value={inventoryCode}
                  onChange={(event) => setInventoryCode(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="copy-location">Location</Label>
                <Input
                  id="copy-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createCopyMutation.isPending}>
                  {createCopyMutation.isPending ? "Adding..." : "Add copy"}
                </Button>
              </div>
            </form>
          ) : null}
          {copyError ? <p className="text-sm text-destructive">{copyError}</p> : null}

          {copiesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading copies...</p>
          ) : copiesQuery.isError ? (
            <p className="text-sm text-destructive">Unable to load copies.</p>
          ) : (
            <CatalogTable>
              <CatalogTableHead columns={["Inventory code", "Location", "Status", "Acquired"]} />
              <tbody>
                {copiesQuery.data?.length ? (
                  copiesQuery.data.map((copy) => (
                    <tr key={copy.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{copy.inventory_code}</td>
                      <td className="px-4 py-3">{copy.location ?? "—"}</td>
                      <td className="px-4 py-3">{copy.status}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {copy.acquired_date
                          ? new Date(copy.acquired_date).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      {isStaff
                        ? "No copies yet. Add the first physical copy above."
                        : "No physical copies recorded."}
                    </td>
                  </tr>
                )}
              </tbody>
            </CatalogTable>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
