import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { REFERENCE_DATA_STALE_TIME } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import { useIsStaff } from "@/lib/roles";
import { appToast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { deleteCategory, listCategories } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogRecordCard,
  CatalogTable,
  CatalogTableHead,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";

export function CategoriesListPage() {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  const filteredCategories = useMemo(() => {
    if (!data) {
      return [];
    }
    const term = search.trim().toLowerCase();
    if (!term) {
      return data;
    }
    return data.filter(
      (category) =>
        category.name.toLowerCase().includes(term) ||
        category.description?.toLowerCase().includes(term),
    );
  }, [data, search]);

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      appToast.deleted("Category");
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error) => setDeleteError(getApiErrorMessage(error, "Unable to delete category.")),
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title="Categories"
        description={isStaff ? "Manage book categories." : "Browse book categories."}
        newTo={isStaff ? "/catalog/categories/new" : undefined}
        newLabel="Add category"
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." />

      {isLoading ? (
        <TableListSkeleton columns={3} />
      ) : isError ? (
        <QueryErrorState message="Unable to load categories." onRetry={() => void refetch()} />
      ) : (
        <>
          <CatalogTable
            mobileContent={filteredCategories.map((category) => (
              <CatalogRecordCard
                key={category.id}
                title={category.name}
                fields={[{ label: "Description", value: category.description ?? "—", wide: true }]}
                actions={isStaff ? <>
                  <Button variant="outline" size="sm" asChild><Link to={`/catalog/categories/${category.id}/edit`}>Edit</Link></Button>
                  <Button variant="outline" size="sm" disabled={deleteMutation.isPending} onClick={() => { setDeleteError(null); setPendingDelete({ id: category.id, name: category.name }); }}>Delete</Button>
                </> : undefined}
              />
            ))}
          >
            <CatalogTableHead
              columns={isStaff ? ["Name", "Description", "Actions"] : ["Name", "Description"]}
            />
            <tbody>
              {filteredCategories.map((category) => (
                <tr key={category.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{category.name}</td>
                  <td className="max-w-md truncate px-4 py-3 text-muted-foreground">
                    {category.description ?? "—"}
                  </td>
                  {isStaff ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/catalog/categories/${category.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => { setDeleteError(null); setPendingDelete({ id: category.id, name: category.name }); }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {filteredCategories.length === 0 ? (
                <tr><td colSpan={isStaff ? 3 : 2} className="px-4 py-8 text-center text-sm text-muted-foreground">{search.trim() ? "No categories match your search." : "No categories have been added yet."}</td></tr>
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
        title="Delete Category?"
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
