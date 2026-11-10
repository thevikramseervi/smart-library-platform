import { useQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCoverImage } from "@/pages/catalog/components/BookCoverImage";
import { getMyRecommendations } from "@/services/recommendations";

export function StudentRecommendations() {
  const query = useQuery({
    queryKey: ["recommendations", "me"],
    queryFn: () => getMyRecommendations(),
  });
  const recommendations = query.data ?? [];

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Recommended for you
          </CardTitle>
          <CardDescription>Suggestions based on your ratings and borrowing history.</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/catalog/books">Browse catalog</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex gap-3 rounded-xl border p-3">
                <Skeleton className="h-24 w-16 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <QueryErrorState
            message="Unable to load book recommendations."
            onRetry={() => void query.refetch()}
          />
        ) : recommendations.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <BookOpen className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No borrowable recommendations right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse the catalog or check back when more copies are available.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map(({ book, reason }) => (
              <Link
                key={book.id}
                to={`/catalog/books/${book.id}`}
                className="group flex min-w-0 gap-3 rounded-xl border border-border/70 bg-background/70 p-3 transition-colors hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary/60">
                  <BookOpen className="absolute inset-0 m-auto size-6 text-primary/60" aria-hidden="true" />
                  {book.cover_image_url ? (
                    <BookCoverImage
                      src={book.cover_image_url}
                      title={book.title}
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-col">
                  <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">
                    {book.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {book.authors?.map((author) => author.name).join(", ") || "Author not listed"}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-primary/80">{reason}</p>
                  <p className="mt-auto pt-2 text-xs text-muted-foreground">
                    {book.available_copies} of {book.total_copies} available
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
