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
import { deletePublisher, listPublishers } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogRecordCard,
  CatalogTable,
  CatalogTableHead,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";

export function PublishersListPage() {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["publishers"],
    queryFn: listPublishers,
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  const filteredPublishers = useMemo(() => {
    if (!data) {
      return [];
    }
    const term = search.trim().toLowerCase();
    if (!term) {
      return data;
    }
    return data.filter(
      (publisher) =>
        publisher.name.toLowerCase().includes(term) ||
        publisher.country?.toLowerCase().includes(term) ||
        publisher.website?.toLowerCase().includes(term),
    );
  }, [data, search]);

  const deleteMutation = useMutation({
    mutationFn: deletePublisher,
    onSuccess: () => {
      appToast.deleted("Publisher");
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["publishers"] });
    },
    onError: (error) => setDeleteError(getApiErrorMessage(error, "Unable to delete publisher.")),
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title="Publishers"
        description={isStaff ? "Manage book publishers." : "Browse book publishers."}
        newTo={isStaff ? "/catalog/publishers/new" : undefined}
        newLabel="Add publisher"
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search publishers..." />

      {isLoading ? (
        <TableListSkeleton columns={3} />
      ) : isError ? (
        <QueryErrorState message="Unable to load publishers." onRetry={() => void refetch()} />
      ) : (
        <>
          <CatalogTable
            mobileContent={filteredPublishers.map((publisher) => (
              <CatalogRecordCard
                key={publisher.id}
                title={publisher.name}
                fields={[
                  { label: "Country", value: publisher.country ?? "—" },
                  { label: "Website", value: publisher.website ? <a href={publisher.website} target="_blank" rel="noreferrer" className="break-all text-primary underline-offset-4 hover:underline">{publisher.website}</a> : "—", wide: true },
                ]}
                actions={isStaff ? <>
                  <Button variant="outline" size="sm" asChild><Link to={`/catalog/publishers/${publisher.id}/edit`}>Edit</Link></Button>
                  <Button variant="outline" size="sm" disabled={deleteMutation.isPending} onClick={() => { setDeleteError(null); setPendingDelete({ id: publisher.id, name: publisher.name }); }}>Delete</Button>
                </> : undefined}
              />
            ))}
          >
            <CatalogTableHead
              columns={
                isStaff ? ["Name", "Country", "Website", "Actions"] : ["Name", "Country", "Website"]
              }
            />
            <tbody>
              {filteredPublishers.map((publisher) => (
                <tr key={publisher.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{publisher.name}</td>
                  <td className="px-4 py-3">{publisher.country ?? "—"}</td>
                  <td className="px-4 py-3">
                    {publisher.website ? (
                      <a
                        href={publisher.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {publisher.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  {isStaff ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/catalog/publishers/${publisher.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => { setDeleteError(null); setPendingDelete({ id: publisher.id, name: publisher.name }); }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {filteredPublishers.length === 0 ? (
                <tr><td colSpan={isStaff ? 4 : 3} className="px-4 py-8 text-center text-sm text-muted-foreground">{search.trim() ? "No publishers match your search." : "No publishers have been added yet."}</td></tr>
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
        title="Delete Publisher?"
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
