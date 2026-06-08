import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appToast } from "@/lib/toast";
import {
  createBook,
  getBook,
  listAuthors,
  listCategories,
  listLanguages,
  listPublishers,
  updateBook,
} from "@/services/catalog";
import {
  CatalogPageHeader,
  FormSelect,
  FormTextarea,
  MultiSelectList,
} from "@/pages/catalog/components/CatalogShared";

export function BookFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [edition, setEdition] = useState("");
  const [publicationYear, setPublicationYear] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isDigital, setIsDigital] = useState(false);
  const [authorIds, setAuthorIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bookQuery = useQuery({
    queryKey: ["books", id],
    queryFn: () => getBook(id!),
    enabled: isEdit,
  });

  const publishersQuery = useQuery({
    queryKey: ["publishers", "all"],
    queryFn: listPublishers,
  });

  const languagesQuery = useQuery({
    queryKey: ["languages", "all"],
    queryFn: listLanguages,
  });

  const authorsQuery = useQuery({
    queryKey: ["authors", "all"],
    queryFn: listAuthors,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: listCategories,
  });

  useEffect(() => {
    if (bookQuery.data) {
      const book = bookQuery.data;
      setTitle(book.title);
      setIsbn(book.isbn ?? "");
      setPublisherId(book.publisher_id);
      setLanguageId(book.language_id);
      setEdition(book.edition ?? "");
      setPublicationYear(book.publication_year?.toString() ?? "");
      setDescription(book.description ?? "");
      setCoverImageUrl(book.cover_image_url ?? "");
      setIsDigital(book.is_digital);
      setAuthorIds(book.authors?.map((author) => author.id) ?? []);
      setCategoryIds(book.categories?.map((category) => category.id) ?? []);
    }
  }, [bookQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        isbn: isbn || null,
        publisher_id: publisherId,
        language_id: languageId,
        edition: edition || null,
        publication_year: publicationYear ? Number(publicationYear) : null,
        description: description || null,
        cover_image_url: coverImageUrl || null,
        is_digital: isDigital,
        author_ids: authorIds,
        category_ids: categoryIds,
      };
      if (isEdit) {
        return updateBook(id!, payload);
      }
      return createBook(payload);
    },
    onSuccess: (book) => {
      appToast[isEdit ? "updated" : "created"]("Book");
      queryClient.invalidateQueries({ queryKey: ["books"] });
      navigate(isEdit ? `/catalog/books/${book.id}` : "/catalog/books");
    },
    onError: (error) => {
      if (isAxiosError(error) && typeof error.response?.data?.detail === "string") {
        setErrorMessage(error.response.data.detail);
        return;
      }
      setErrorMessage("Unable to save book.");
    },
  });

  const publisherOptions =
    publishersQuery.data?.map((publisher) => ({
      value: publisher.id,
      label: publisher.name,
    })) ?? [];

  const languageOptions =
    languagesQuery.data?.map((language) => ({
      value: language.id,
      label: `${language.name} (${language.code})`,
    })) ?? [];

  const authorOptions =
    authorsQuery.data?.map((author) => ({
      id: author.id,
      label: author.name,
    })) ?? [];

  const categoryOptions =
    categoriesQuery.data?.map((category) => ({
      id: category.id,
      label: category.name,
    })) ?? [];

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title={isEdit ? "Edit book" : "New book"}
        description={isEdit ? "Update book metadata." : "Create a new catalog book."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Book details</CardTitle>
        </CardHeader>
        <CardContent>
          {isEdit && bookQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading book...</p>
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
                <Label htmlFor="book-title">Title</Label>
                <Input
                  id="book-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="book-isbn">ISBN</Label>
                  <Input
                    id="book-isbn"
                    value={isbn}
                    onChange={(event) => setIsbn(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="book-year">Publication year</Label>
                  <Input
                    id="book-year"
                    type="number"
                    value={publicationYear}
                    onChange={(event) => setPublicationYear(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelect
                  id="book-publisher"
                  label="Publisher"
                  value={publisherId}
                  onChange={setPublisherId}
                  options={publisherOptions}
                  required
                />
                <FormSelect
                  id="book-language"
                  label="Language"
                  value={languageId}
                  onChange={setLanguageId}
                  options={languageOptions}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="book-edition">Edition</Label>
                <Input
                  id="book-edition"
                  value={edition}
                  onChange={(event) => setEdition(event.target.value)}
                />
              </div>
              <FormTextarea
                id="book-description"
                label="Description"
                value={description}
                onChange={setDescription}
              />
              <div className="space-y-2">
                <Label htmlFor="book-cover">Cover image URL</Label>
                <Input
                  id="book-cover"
                  type="url"
                  value={coverImageUrl}
                  onChange={(event) => setCoverImageUrl(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDigital}
                  onChange={(event) => setIsDigital(event.target.checked)}
                  className="size-4 rounded border-input"
                />
                Digital resource available
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <MultiSelectList
                  label="Authors"
                  options={authorOptions}
                  selectedIds={authorIds}
                  onChange={setAuthorIds}
                />
                <MultiSelectList
                  label="Categories"
                  options={categoryOptions}
                  selectedIds={categoryIds}
                  onChange={setCategoryIds}
                />
              </div>
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save book"}
                </Button>
                <Button variant="outline" asChild>
                  <Link to={isEdit ? `/catalog/books/${id}` : "/catalog/books"}>Cancel</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
