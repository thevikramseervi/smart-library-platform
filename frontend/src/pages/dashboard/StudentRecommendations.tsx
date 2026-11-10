import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, EyeOff, Sparkles, Star, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/apiError";
import { DASHBOARD_STALE_TIME } from "@/lib/queryClient";
import { BookCoverImage } from "@/pages/catalog/components/BookCoverImage";
import {
  getMyRecommendations,
  saveRecommendationFeedback,
  type BookRecommendation,
  type RecommendationFeedbackSignal,
} from "@/services/recommendations";

export function StudentRecommendations() {
  const queryClient = useQueryClient();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const query = useQuery({
    queryKey: ["recommendations", "me"],
    queryFn: () => getMyRecommendations(20),
    staleTime: DASHBOARD_STALE_TIME,
  });
  const feedbackMutation = useMutation({
    mutationFn: ({ bookId, signal }: { bookId: string; signal: RecommendationFeedbackSignal }) =>
      saveRecommendationFeedback(bookId, signal),
    onMutate: () => setFeedbackError(null),
    onSuccess: (_result, { bookId, signal }) => {
      if (signal === "LIKE") {
        queryClient.setQueryData<BookRecommendation[]>(["recommendations", "me"], (current) =>
          current?.map((recommendation) => recommendation.book.id === bookId
            ? { ...recommendation, feedback_signal: "LIKE" }
            : recommendation),
        );
        return;
      }
      setStartIndex(0);
      return queryClient.invalidateQueries({ queryKey: ["recommendations", "me"] });
    },
    onError: (error) => setFeedbackError(getApiErrorMessage(error, "Unable to save your preference.")),
  });
  const recommendations = query.data ?? [];
  const visibleRecommendations = recommendations.slice(startIndex, startIndex + 6);
  const endIndex = Math.min(startIndex + 6, recommendations.length);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Recommended for you
          </CardTitle>
          <CardDescription>A mix of your interests and popular, highly rated books.</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/catalog/books">Browse catalog</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, item) => (
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
          <>
          {feedbackError ? <p role="alert" className="mb-3 text-sm text-destructive">{feedbackError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleRecommendations.map(({ book, reason, average_rating, rating_count, feedback_signal }) => (
              <article
                key={book.id}
                className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-background/70 p-3 transition-colors hover:border-primary/30 hover:bg-card"
              >
                <Link
                  to={`/catalog/books/${book.id}`}
                  className="group flex min-w-0 gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  {book.categories?.length ? (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {book.categories.map((category) => category.name).join(" · ")}
                    </p>
                  ) : null}
                  {rating_count > 0 && average_rating !== null ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="size-3 fill-amber-400 text-amber-500" aria-hidden="true" />
                      {average_rating.toFixed(1)} <span>({rating_count})</span>
                    </p>
                  ) : null}
                  <p className="mt-2 line-clamp-2 text-xs text-primary/80">{reason}</p>
                  <p className="mt-auto pt-2 text-xs text-muted-foreground">
                    {book.available_copies} of {book.total_copies} available
                  </p>
                </div>
                </Link>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={feedback_signal === "LIKE" ? "secondary" : "ghost"}
                    className="h-8 px-2 text-xs"
                    disabled={feedbackMutation.isPending}
                    onClick={() => feedbackMutation.mutate({ bookId: book.id, signal: "LIKE" })}
                  >
                    <ThumbsUp aria-hidden="true" />
                    {feedback_signal === "LIKE" ? "Liked · more like this" : "More like this"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    disabled={feedbackMutation.isPending}
                    onClick={() => feedbackMutation.mutate({ bookId: book.id, signal: "DISMISS" })}
                  >
                    <EyeOff aria-hidden="true" />
                    Not interested
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {recommendations.length > 6 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">
                Showing {startIndex + 1}–{endIndex} of {recommendations.length} suggestions
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={startIndex === 0}
                  onClick={() => setStartIndex((current) => Math.max(0, current - 6))}
                >
                  <ArrowLeft aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={endIndex >= recommendations.length}
                  onClick={() => setStartIndex((current) => current + 6)}
                >
                  More suggestions
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
