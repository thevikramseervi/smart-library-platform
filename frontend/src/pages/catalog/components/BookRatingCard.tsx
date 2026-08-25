import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Star } from "lucide-react";

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
import {
  deleteMyRating,
  fetchRatingSummary,
  fetchMyRating,
  upsertMyRating,
} from "@/services/catalog/ratings";

interface BookRatingCardProps {
  bookId: string;
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
          className={cn(
            "rounded p-0.5 transition-colors disabled:opacity-50",
            !pending && "hover:bg-muted",
          )}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelect(star)}
        >
          <Star
            className={cn(
              "size-6",
              star <= display ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function BookRatingCard({ bookId }: BookRatingCardProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["ratings", "summary", bookId],
    queryFn: () => fetchRatingSummary(bookId),
  });

  const myRatingQuery = useQuery({
    queryKey: ["ratings", "me", bookId],
    queryFn: () => fetchMyRating(bookId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ratings", "summary", bookId] });
    queryClient.invalidateQueries({ queryKey: ["ratings", "me", bookId] });
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

  const deleteMutation = useMutation({
    mutationFn: () => deleteMyRating(bookId),
    onSuccess: () => {
      setErrorMessage(null);
      appToast.deleted("Rating");
      invalidate();
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error, "Unable to remove rating.")),
  });

  const average = summaryQuery.data?.average ?? null;
  const count = summaryQuery.data?.count ?? 0;
  const myScore = myRatingQuery.data?.score ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ratings</CardTitle>
        <CardDescription>
          {count === 0
            ? "No ratings yet — be the first."
            : `Average ${average!.toFixed(1)} out of 5 · ${count} rating${count === 1 ? "" : "s"}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <StarPicker
            value={myScore}
            pending={upsertMutation.isPending}
            onSelect={(score) => upsertMutation.mutate(score)}
          />
          {myScore > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending || upsertMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Remove my rating
            </Button>
          ) : null}
        </div>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </CardContent>
    </Card>
  );
}
