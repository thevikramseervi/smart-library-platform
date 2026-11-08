import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryErrorState } from "@/components/ui/query-error-state";

import { Button } from "@/components/ui/button";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import { useIsStaff } from "@/lib/roles";
import { appToast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { deleteAuthor, listAuthors } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogRecordCard,
  CatalogTable,
  CatalogTableHead,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";

export function AuthorsListPage() {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const { data, isLoading, isError, refetch } = useQuery({
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
    onSuccess: () => {
      appToast.deleted("Author");
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["authors"] });
    },
    onError: (error) => setDeleteError(getApiErrorMessage(error, "Unable to delete author.")),
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
        <TableListSkeleton columns={3} />
      ) : isError ? (
        <QueryErrorState message="Unable to load authors." onRetry={() => void refetch()} />
      ) : (
        <>
          <CatalogTable
            mobileContent={filteredAuthors.map((author) => (
              <CatalogRecordCard
                key={author.id}
                title={author.name}
                fields={[{ label: "Biography", value: author.bio ?? "—", wide: true }]}
                actions={isStaff ? <>
                  <Button variant="outline" size="sm" asChild><Link to={`/catalog/authors/${author.id}/edit`}>Edit</Link></Button>
                  <Button variant="outline" size="sm" disabled={deleteMutation.isPending} onClick={() => { setDeleteError(null); setPendingDelete({ id: author.id, name: author.name }); }}>Delete</Button>
                </> : undefined}
              />
            ))}
          >
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
                          onClick={() => { setDeleteError(null); setPendingDelete({ id: author.id, name: author.name }); }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {filteredAuthors.length === 0 ? (
                <tr><td colSpan={isStaff ? 3 : 2} className="px-4 py-8 text-center text-sm text-muted-foreground">{search.trim() ? "No authors match your search." : "No authors have been added yet."}</td></tr>
              ) : null}
            </tbody>
          </CatalogTable>
        </>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        title="Delete Author?"
        description={`"${pendingDelete?.name ?? ""}" will be soft-deleted.`}
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
