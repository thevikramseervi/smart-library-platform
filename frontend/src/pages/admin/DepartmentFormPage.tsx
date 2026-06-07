import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDepartment, getDepartment, updateDepartment } from "@/services/admin";
import { getApiErrorMessage } from "@/lib/apiError";
import { CatalogPageHeader } from "@/pages/catalog/components/CatalogShared";

export function DepartmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const departmentQuery = useQuery({
    queryKey: ["departments", id],
    queryFn: () => getDepartment(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (departmentQuery.data) {
      setName(departmentQuery.data.name);
      setCode(departmentQuery.data.code);
      setDescription(departmentQuery.data.description ?? "");
    }
  }, [departmentQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        code,
        description: description || null,
      };
      if (isEdit) {
        return updateDepartment(id!, payload);
      }
      return createDepartment(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      navigate("/admin/departments");
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, "Unable to save department."));
    },
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title={isEdit ? "Edit department" : "New department"}
        description={isEdit ? "Update department details." : "Create a new department."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Department details</CardTitle>
        </CardHeader>
        <CardContent>
          {isEdit && departmentQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading department...</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="department-name">Name</Label>
                <Input
                  id="department-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-code">Code</Label>
                <Input
                  id="department-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-description">Description</Label>
                <Input
                  id="department-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save department"}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/admin/departments">Cancel</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
