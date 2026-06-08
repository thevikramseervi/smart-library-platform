import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteDepartment, listDepartments } from "@/services/admin";
import { getApiErrorMessage } from "@/lib/apiError";
import { appToast } from "@/lib/toast";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";
import type { DepartmentResponse } from "@/types/admin";

export function DepartmentsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DepartmentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const filteredDepartments = useMemo(() => {
    if (!data) {
      return [];
    }
    const term = search.trim().toLowerCase();
    if (!term) {
      return data;
    }
    return data.filter(
      (department) =>
        department.name.toLowerCase().includes(term) ||
        department.code.toLowerCase().includes(term) ||
        department.description?.toLowerCase().includes(term),
    );
  }, [data, search]);

  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      appToast.deleted("Department");
      setErrorMessage(null);
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, "Unable to delete department."));
    },
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title="Departments"
        description="Manage academic departments used for student accounts."
        newTo="/admin/departments/new"
        newLabel="Add department"
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search departments..." />

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {isLoading ? (
        <TableListSkeleton columns={4} showRecordCount={false} />
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load departments.</p>
      ) : (
        <CatalogTable>
          <CatalogTableHead columns={["Code", "Name", "Description", "Actions"]} />
          <tbody>
            {filteredDepartments.map((department) => (
              <tr key={department.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{department.code}</td>
                <td className="px-4 py-3">{department.name}</td>
                <td className="px-4 py-3">{department.description ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/departments/${department.id}/edit`}>Edit</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setErrorMessage(null);
                        setPendingDelete(department);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </CatalogTable>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete department</DialogTitle>
            <DialogDescription>
              This permanently deletes the department. Deletion is blocked while users are assigned.
            </DialogDescription>
          </DialogHeader>
          {pendingDelete ? (
            <p className="text-sm">
              Delete <span className="font-medium">{pendingDelete.name}</span> ({pendingDelete.code})?
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={!pendingDelete || deleteMutation.isPending}
              onClick={() => {
                if (pendingDelete) {
                  deleteMutation.mutate(pendingDelete.id);
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
