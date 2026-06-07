import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPublisher, getPublisher, updatePublisher } from "@/services/catalog";
import { CatalogPageHeader } from "@/pages/catalog/components/CatalogShared";

export function PublisherFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const publisherQuery = useQuery({
    queryKey: ["publishers", id],
    queryFn: () => getPublisher(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (publisherQuery.data) {
      setName(publisherQuery.data.name);
      setWebsite(publisherQuery.data.website ?? "");
      setCountry(publisherQuery.data.country ?? "");
    }
  }, [publisherQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        website: website || null,
        country: country || null,
      };
      if (isEdit) {
        return updatePublisher(id!, payload);
      }
      return createPublisher(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers"] });
      navigate("/catalog/publishers");
    },
    onError: (error) => {
      if (isAxiosError(error) && typeof error.response?.data?.detail === "string") {
        setErrorMessage(error.response.data.detail);
        return;
      }
      setErrorMessage("Unable to save publisher.");
    },
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title={isEdit ? "Edit publisher" : "New publisher"}
        description={isEdit ? "Update publisher details." : "Create a new publisher."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publisher details</CardTitle>
        </CardHeader>
        <CardContent>
          {isEdit && publisherQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading publisher...</p>
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
                <Label htmlFor="publisher-name">Name</Label>
                <Input
                  id="publisher-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publisher-website">Website</Label>
                <Input
                  id="publisher-website"
                  type="url"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publisher-country">Country</Label>
                <Input
                  id="publisher-country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
              </div>
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save publisher"}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/catalog/publishers">Cancel</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
