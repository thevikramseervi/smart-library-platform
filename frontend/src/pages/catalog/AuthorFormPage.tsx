import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appToast } from "@/lib/toast";
import { createAuthor, getAuthor, updateAuthor } from "@/services/catalog";
import { CatalogPageHeader, FormTextarea } from "@/pages/catalog/components/CatalogShared";

export function AuthorFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const authorQuery = useQuery({
    queryKey: ["authors", id],
    queryFn: () => getAuthor(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (authorQuery.data) {
      setName(authorQuery.data.name);
      setBio(authorQuery.data.bio ?? "");
    }
  }, [authorQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name, bio: bio || null };
      if (isEdit) {
        return updateAuthor(id!, payload);
      }
      return createAuthor(payload);
    },
    onSuccess: () => {
      appToast[isEdit ? "updated" : "created"]("Author");
      queryClient.invalidateQueries({ queryKey: ["authors"] });
      navigate("/catalog/authors");
    },
    onError: (error) => {
      if (isAxiosError(error) && typeof error.response?.data?.detail === "string") {
        setErrorMessage(error.response.data.detail);
        return;
      }
      setErrorMessage("Unable to save author.");
    },
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title={isEdit ? "Edit author" : "New author"}
        description={isEdit ? "Update author details." : "Create a new author."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Author details</CardTitle>
        </CardHeader>
        <CardContent>
          {isEdit && authorQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading author...</p>
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
                <Label htmlFor="author-name">Name</Label>
                <Input
                  id="author-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <FormTextarea id="author-bio" label="Bio" value={bio} onChange={setBio} />
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save author"}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/catalog/authors">Cancel</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
