import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useIsStaff } from "@/components/auth/StaffRoute";
import { deleteAuthor, listAuthors } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";

export function AuthorsListPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["authors"],
    queryFn: listAuthors,
  });

  const filteredAuthors = useMemo(() => {
    if (!data) {
      return [];
    }
    const term = search.trim().toLowerCase();
    if (!term) {
      return data;
    }
    return data.filter(
      (author) =>
        author.name.toLowerCase().includes(term) ||
        author.bio?.toLowerCase().includes(term),
    );
  }, [data, search]);

  const deleteMutation = useMutation({
    mutationFn: deleteAuthor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authors"] }),
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title="Authors"
        description={isStaff ? "Manage book authors." : "Browse book authors."}
        newTo={isStaff ? "/catalog/authors/new" : undefined}
        newLabel="Add author"
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search authors..." />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading authors...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load authors.</p>
      ) : (
        <>
          <CatalogTable>
            <CatalogTableHead columns={isStaff ? ["Name", "Bio", "Actions"] : ["Name", "Bio"]} />
            <tbody>
              {filteredAuthors.map((author) => (
                <tr key={author.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{author.name}</td>
                  <td className="max-w-md truncate px-4 py-3 text-muted-foreground">
                    {author.bio ?? "—"}
                  </td>
                  {isStaff ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/catalog/authors/${author.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete author "${author.name}"?`)) {
                              deleteMutation.mutate(author.id);
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
        </>
      )}
    </section>
  );
}
