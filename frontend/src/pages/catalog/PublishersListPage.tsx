import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import { useIsStaff } from "@/components/auth/StaffRoute";
import { appToast } from "@/lib/toast";
import { deletePublisher, listPublishers } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";

export function PublishersListPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["publishers"],
    queryFn: listPublishers,
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
      queryClient.invalidateQueries({ queryKey: ["publishers"] });
    },
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
        <p className="text-sm text-destructive">Unable to load publishers.</p>
      ) : (
        <>
          <CatalogTable>
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
                          onClick={() => {
                            if (window.confirm(`Delete publisher "${publisher.name}"?`)) {
                              deleteMutation.mutate(publisher.id);
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
