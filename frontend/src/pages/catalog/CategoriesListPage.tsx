import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useIsStaff } from "@/components/auth/StaffRoute";
import { deleteCategory, listCategories } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogTable,
  CatalogTableHead,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";

export function CategoriesListPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
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
        <p className="text-sm text-muted-foreground">Loading categories...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load categories.</p>
      ) : (
        <>
          <CatalogTable>
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
                          onClick={() => {
                            if (window.confirm(`Delete category "${category.name}"?`)) {
                              deleteMutation.mutate(category.id);
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
