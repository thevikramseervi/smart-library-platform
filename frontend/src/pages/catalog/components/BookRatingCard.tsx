import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { appToast } from "@/lib/toast";
import { formatDashboardDate } from "@/lib/format";
import { QueryErrorState } from "@/components/ui/query-error-state";
import {
  deleteMyRating,
  deleteMyReview,
  fetchRatingSummary,
  fetchMyRating,
  listBookReviews,
  upsertMyRating,
  upsertMyReview,
} from "@/services/catalog/ratings";

interface BookRatingCardProps {
  bookId: string;
  allowRating?: boolean;
}

function StarPicker({
  value,
  pending,
  onSelect,
}: {
  value: number;
  pending: boolean;
  onSelect: (score: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          disabled={pending}
          className={cn("rounded p-0.5 transition-colors disabled:opacity-50", !pending && "hover:bg-muted")}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelect(star)}
        >
          <Star className={cn("size-6", star <= display ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
        </button>
      ))}
    </div>
  );
}

export function BookRatingCard({ bookId, allowRating = true }: BookRatingCardProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewDraftState, setReviewDraftState] = useState<{
    savedReview: string;
    draft: string;
  } | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["ratings", "summary", bookId],
    queryFn: () => fetchRatingSummary(bookId),
  });
  const myRatingQuery = useQuery({
    queryKey: ["ratings", "me", bookId],
    queryFn: () => fetchMyRating(bookId),
    enabled: allowRating,
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews", bookId, 1],
    queryFn: () => listBookReviews(bookId),
  });

  const savedReview = myRatingQuery.data?.review_text ?? "";
  const reviewDraft = reviewDraftState?.savedReview === savedReview
    ? reviewDraftState.draft
    : savedReview;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["ratings", "summary", bookId] });
    void queryClient.invalidateQueries({ queryKey: ["ratings", "me", bookId] });
    void queryClient.invalidateQueries({ queryKey: ["reviews", bookId] });
    void queryClient.invalidateQueries({ queryKey: ["recommendations", "me"] });
  };

  const upsertMutation = useMutation({
    mutationFn: (score: number) => upsertMyRating(bookId, score),
    onSuccess: () => {
      setErrorMessage(null);
      appToast.success("Rating saved");
      invalidate();
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error, "Unable to save rating.")),
  });
  const deleteRatingMutation = useMutation({
    mutationFn: () => deleteMyRating(bookId),
    onSuccess: () => {
      setReviewDraftState({ savedReview, draft: "" });
      setErrorMessage(null);
      appToast.deleted("Rating");
      invalidate();
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error, "Unable to remove rating.")),
  });
  const saveReviewMutation = useMutation({
    mutationFn: () => upsertMyReview(bookId, reviewDraft.trim()),
    onSuccess: () => {
      setErrorMessage(null);
      appToast.success("Review saved");
      invalidate();
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error, "Unable to save review.")),
  });
  const deleteReviewMutation = useMutation({
    mutationFn: () => deleteMyReview(bookId),
    onSuccess: () => {
      setReviewDraftState({ savedReview, draft: "" });
      setErrorMessage(null);
      appToast.deleted("Review");
      invalidate();
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error, "Unable to remove review.")),
  });

  const average = summaryQuery.data?.average ?? null;
  const count = summaryQuery.data?.count ?? 0;
  const myRating = myRatingQuery.data;
  const myScore = myRating?.score ?? 0;
  const reviewUnchanged = reviewDraft.trim() === savedReview;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ratings &amp; reviews</CardTitle>
        <CardDescription>
          {summaryQuery.isLoading
            ? "Loading ratings..."
            : summaryQuery.isError
              ? "Ratings could not be loaded."
              : count === 0
                ? "No ratings yet — be the first."
                : (
                  <span className="inline-flex items-center gap-1.5">
                    <Star aria-hidden="true" className="size-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-foreground">{average!.toFixed(1)} / 5</span>
                    <span>· {count} rating{count === 1 ? "" : "s"}</span>
                  </span>
                )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {summaryQuery.isError ? <QueryErrorState message="Unable to load rating summary." onRetry={() => void summaryQuery.refetch()} /> : null}
        {allowRating && myRatingQuery.isError ? <QueryErrorState message="Unable to load your rating." onRetry={() => void myRatingQuery.refetch()} /> : null}
        {allowRating && !summaryQuery.isError && !myRatingQuery.isError ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Your rating</p>
                <p className="text-xs text-muted-foreground">Choose a star from 1 to 5.</p>
              </div>
              <div className="flex items-center gap-3">
                <StarPicker
                  value={myScore}
                  pending={summaryQuery.isLoading || myRatingQuery.isLoading || upsertMutation.isPending}
                  onSelect={(score) => upsertMutation.mutate(score)}
                />
                {myScore > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleteRatingMutation.isPending || upsertMutation.isPending}
                    onClick={() => deleteRatingMutation.mutate()}
                  >
                    {myRating?.review_text ? "Remove rating & review" : "Remove rating"}
                  </Button>
                ) : null}
              </div>
            </div>
            {myScore > 0 ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                <label htmlFor="book-review" className="text-sm font-medium">Your written review <span className="font-normal text-muted-foreground">(optional)</span></label>
                <textarea
                  id="book-review"
                  value={reviewDraft}
                  maxLength={2000}
                  rows={4}
                  onChange={(event) => setReviewDraftState({
                    savedReview,
                    draft: event.target.value,
                  })}
                  placeholder="What did you think of this book?"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{reviewDraft.length}/2000 characters</span>
                  <div className="flex gap-2">
                    {myRating?.review_text ? (
                      <Button variant="ghost" size="sm" disabled={deleteReviewMutation.isPending} onClick={() => deleteReviewMutation.mutate()}>
                        Remove review
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={!reviewDraft.trim() || reviewUnchanged || saveReviewMutation.isPending}
                      onClick={() => saveReviewMutation.mutate()}
                    >
                      {saveReviewMutation.isPending ? "Saving..." : myRating?.review_text ? "Update review" : "Post review"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Rate this book to write a review.</p>
            )}
          </div>
        ) : null}
        {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}

        <div className="border-t pt-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">Reader reviews</h3>
            <span className="text-sm text-muted-foreground">{reviewsQuery.data?.total ?? 0}</span>
          </div>
          {reviewsQuery.isError ? <QueryErrorState message="Unable to load reviews." onRetry={() => void reviewsQuery.refetch()} /> : null}
          {reviewsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading reviews...</p> : null}
          {reviewsQuery.data?.items.length === 0 ? <p className="text-sm text-muted-foreground">No written reviews yet.</p> : null}
          <div className="space-y-3">
            {reviewsQuery.data?.items.map((review) => (
              <article key={review.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{review.reviewer_name}</p>
                  <time dateTime={review.updated_at} className="text-xs text-muted-foreground">
                    {formatDashboardDate(review.updated_at)}
                  </time>
                </div>
                <div className="mt-1 flex" role="img" aria-label={`${review.score} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} aria-hidden="true" className={cn("size-4", star <= review.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                  ))}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{review.review_text}</p>
              </article>
            ))}
          </div>
          {reviewsQuery.data && reviewsQuery.data.total > reviewsQuery.data.items.length ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Showing the 10 most recent reviews of {reviewsQuery.data.total}.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
