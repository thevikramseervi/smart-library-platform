import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { REFERENCE_DATA_STALE_TIME } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import { useIsStaff } from "@/lib/roles";
import { appToast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { createLanguage, listLanguages } from "@/services/catalog";
import {
  CatalogPageHeader,
  CatalogRecordCard,
  CatalogTable,
  CatalogTableHead,
  SearchInput,
} from "@/pages/catalog/components/CatalogShared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LanguagesListPage() {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isStaff = useIsStaff();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["languages"],
    queryFn: listLanguages,
    staleTime: REFERENCE_DATA_STALE_TIME,
  });

  const filteredLanguages = useMemo(() => {
    if (!data) {
      return [];
    }
    const term = search.trim().toLowerCase();
    if (!term) {
      return data;
    }
    return data.filter(
      (language) =>
        language.name.toLowerCase().includes(term) ||
        language.code.toLowerCase().includes(term),
    );
  }, [data, search]);

  const createMutation = useMutation({
    mutationFn: () => createLanguage({ name, code }),
    onSuccess: () => {
      appToast.created("Language");
      setName("");
      setCode("");
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["languages"] });
    },
    onError: (error) => setCreateError(getApiErrorMessage(error, "Unable to add language.")),
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title="Languages"
        description={
          isStaff
            ? "Manage book languages used in the catalog."
            : "Browse book languages used in the catalog."
        }
      />

      {isStaff ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add language</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                setCreateError(null);
                createMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="language-name">Name</Label>
                <Input
                  id="language-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language-code">Code</Label>
                <Input
                  id="language-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add language"}
                </Button>
              </div>
            </form>
            {createError ? <p role="alert" className="mt-3 text-sm text-destructive">{createError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <SearchInput value={search} onChange={setSearch} placeholder="Search languages..." />

      {isLoading ? (
        <TableListSkeleton columns={3} />
      ) : isError ? (
        <QueryErrorState message="Unable to load languages." onRetry={() => void refetch()} />
      ) : (
        <>
          <CatalogTable
            mobileContent={filteredLanguages.map((language) => (
              <CatalogRecordCard
                key={language.id}
                title={language.name}
                fields={[
                  { label: "Code", value: language.code },
                  { label: "Created", value: new Date(language.created_at).toLocaleDateString() },
                ]}
              />
            ))}
          >
            <CatalogTableHead columns={["Name", "Code", "Created"]} />
            <tbody>
              {filteredLanguages.map((language) => (
                <tr key={language.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{language.name}</td>
                  <td className="px-4 py-3">{language.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(language.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filteredLanguages.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">{search.trim() ? "No languages match your search." : "No languages have been added yet."}</td></tr>
              ) : null}
            </tbody>
          </CatalogTable>
        </>
      )}
    </section>
  );
}
