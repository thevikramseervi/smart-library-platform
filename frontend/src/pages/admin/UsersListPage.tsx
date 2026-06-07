import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deactivateUser, listDepartments, listUsers } from "@/services/admin";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
  FormSelect,
  PaginationControls,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";
import type { UserResponse } from "@/types/admin";

function formatUserLabel(user: UserResponse): string {
  const identifier = user.student_code ?? user.email;
  return `${user.first_name} ${user.last_name} (${identifier})`;
}

export function UsersListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [pendingDeactivate, setPendingDeactivate] = useState<UserResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const usersQuery = useQuery({
    queryKey: ["users", page, search, roleFilter, departmentFilter, activeFilter],
    queryFn: () =>
      listUsers({
        page,
        page_size: 20,
        q: search || undefined,
        role: roleFilter ? (roleFilter as UserResponse["role"]["name"]) : undefined,
        department_id: departmentFilter || undefined,
        is_active:
          activeFilter === "active" ? true : activeFilter === "inactive" ? false : undefined,
      }),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      setErrorMessage(null);
      setPendingDeactivate(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, "Unable to deactivate user."));
    },
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title="Users"
        description="Manage admin, librarian, and student accounts."
        newTo="/admin/users/new"
        newLabel="Add user"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search users..." />
        <FormSelect
          id="role-filter"
          label="Role"
          value={roleFilter}
          onChange={setRoleFilter}
          placeholder="All roles"
          options={[
            { value: "ADMIN", label: "Admin" },
            { value: "LIBRARIAN", label: "Librarian" },
            { value: "STUDENT", label: "Student" },
          ]}
        />
        <FormSelect
          id="department-filter"
          label="Department"
          value={departmentFilter}
          onChange={setDepartmentFilter}
          placeholder="All departments"
          options={(departmentsQuery.data ?? []).map((department) => ({
            value: department.id,
            label: `${department.code} — ${department.name}`,
          }))}
        />
        <FormSelect
          id="active-filter"
          label="Status"
          value={activeFilter}
          onChange={setActiveFilter}
          placeholder="All statuses"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {usersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading users...</p>
      ) : usersQuery.isError ? (
        <p className="text-sm text-destructive">Unable to load users.</p>
      ) : (
        <>
          <CatalogTable>
            <CatalogTableHead
              columns={["Name", "Email", "Role", "Department", "Status", "Actions"]}
            />
            <tbody>
              {usersQuery.data?.items.map((user) => (
                <tr key={user.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{formatUserLabel(user)}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.role.name}</td>
                  <td className="px-4 py-3">
                    {user.department ? `${user.department.code} — ${user.department.name}` : "—"}
                  </td>
                  <td className="px-4 py-3">{user.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/users/${user.id}/edit`}>Edit</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setErrorMessage(null);
                          setPendingDeactivate(user);
                        }}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </CatalogTable>
          {usersQuery.data ? (
            <PaginationControls
              page={usersQuery.data.page}
              pages={usersQuery.data.total_pages}
              total={usersQuery.data.total}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Dialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeactivate(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate user</DialogTitle>
            <DialogDescription>
              This soft-deletes the account and prevents future logins.
            </DialogDescription>
          </DialogHeader>
          {pendingDeactivate ? (
            <p className="text-sm">
              Deactivate <span className="font-medium">{formatUserLabel(pendingDeactivate)}</span>?
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeactivate(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={!pendingDeactivate || deactivateMutation.isPending}
              onClick={() => {
                if (pendingDeactivate) {
                  deactivateMutation.mutate(pendingDeactivate.id);
                }
              }}
            >
              {deactivateMutation.isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
