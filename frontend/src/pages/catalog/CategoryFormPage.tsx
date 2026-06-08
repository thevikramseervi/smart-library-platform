import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appToast } from "@/lib/toast";
import { createCategory, getCategory, updateCategory } from "@/services/catalog";
import { CatalogPageHeader, FormTextarea } from "@/pages/catalog/components/CatalogShared";

export function CategoryFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categoryQuery = useQuery({
    queryKey: ["categories", id],
    queryFn: () => getCategory(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (categoryQuery.data) {
      setName(categoryQuery.data.name);
      setDescription(categoryQuery.data.description ?? "");
    }
  }, [categoryQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name, description: description || null };
      if (isEdit) {
        return updateCategory(id!, payload);
      }
      return createCategory(payload);
    },
    onSuccess: () => {
      appToast[isEdit ? "updated" : "created"]("Category");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      navigate("/catalog/categories");
    },
    onError: (error) => {
      if (isAxiosError(error) && typeof error.response?.data?.detail === "string") {
        setErrorMessage(error.response.data.detail);
        return;
      }
      setErrorMessage("Unable to save category.");
    },
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title={isEdit ? "Edit category" : "New category"}
        description={isEdit ? "Update category details." : "Create a new category."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category details</CardTitle>
        </CardHeader>
        <CardContent>
          {isEdit && categoryQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading category...</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setErrorMessage(null);
                saveMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <FormTextarea
                id="category-description"
                label="Description"
                value={description}
                onChange={setDescription}
              />
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save category"}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/catalog/categories">Cancel</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
