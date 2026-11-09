import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { formatInr } from "@/lib/formatCurrency";
import { appToast } from "@/lib/toast";
import { CatalogPageHeader } from "@/pages/catalog/components/CatalogShared";
import { getCirculationPolicy, updateCirculationPolicy } from "@/services/admin";
import type { CirculationPolicyResponse, CirculationPolicyUpdate } from "@/types/circulationPolicy";

interface CirculationPolicyFormProps {
  policy: CirculationPolicyResponse;
  isPending: boolean;
  onSubmit: (payload: CirculationPolicyUpdate) => void;
  apiError: string | null;
}

function CirculationPolicyForm({
  policy,
  isPending,
  onSubmit,
  apiError,
}: CirculationPolicyFormProps) {
  const [dailyFineRate, setDailyFineRate] = useState<string>(
    String(policy.daily_overdue_fine_rate)
  );
  const [maxFineAmount, setMaxFineAmount] = useState<string>(
    String(policy.max_fine_amount)
  );
  const [loanPeriodDays, setLoanPeriodDays] = useState<number>(policy.loan_period_days);
  const [maxActiveLoans, setMaxActiveLoans] = useState<number>(policy.max_active_loans);
  const [maxRenewals, setMaxRenewals] = useState<number>(policy.max_renewals);
  const [reservationExpiryDays, setReservationExpiryDays] = useState<number>(
    policy.reservation_expiry_days
  );
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientError(null);

    const rateNum = Number(dailyFineRate);
    const capNum = Number(maxFineAmount);

    if (isNaN(rateNum) || rateNum < 0) {
      setClientError("Daily fine rate must be a non-negative number.");
      return;
    }
    if (isNaN(capNum) || capNum < 0) {
      setClientError("Maximum fine amount must be a non-negative number.");
      return;
    }
    if (rateNum > 0 && capNum < rateNum) {
      setClientError("Maximum fine cap cannot be less than the daily overdue fine rate.");
      return;
    }
    if (loanPeriodDays < 1 || loanPeriodDays > 365) {
      setClientError("Loan period must be between 1 and 365 days.");
      return;
    }
    if (maxActiveLoans < 1 || maxActiveLoans > 50) {
      setClientError("Maximum active loans must be between 1 and 50.");
      return;
    }
    if (reservationExpiryDays < 1 || reservationExpiryDays > 90) {
      setClientError("Reservation expiry must be between 1 and 90 days.");
      return;
    }
    if (!Number.isInteger(maxRenewals) || maxRenewals < 0 || maxRenewals > 5) {
      setClientError("Maximum renewals must be between 0 and 5.");
      return;
    }

    onSubmit({
      daily_overdue_fine_rate: rateNum,
      max_fine_amount: capNum,
      loan_period_days: loanPeriodDays,
      max_active_loans: maxActiveLoans,
      max_renewals: maxRenewals,
      reservation_expiry_days: reservationExpiryDays,
    });
  };

  const errorMessage = clientError || apiError;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="daily-fine-rate">Daily Overdue Fine Rate (₹)</Label>
          <Input
            id="daily-fine-rate"
            type="number"
            step="0.50"
            min="0"
            value={dailyFineRate}
            onChange={(e) => setDailyFineRate(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Charged per calendar day a book is returned late.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-fine-amount">Maximum Fine Cap (₹)</Label>
          <Input
            id="max-fine-amount"
            type="number"
            step="1.00"
            min="0"
            value={maxFineAmount}
            onChange={(e) => setMaxFineAmount(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Upper ceiling on overdue fine for a single loan.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="loan-period">Loan Duration (Days)</Label>
          <Input
            id="loan-period"
            type="number"
            min="1"
            max="365"
            value={loanPeriodDays}
            onChange={(e) => setLoanPeriodDays(Number(e.target.value))}
            required
          />
          <p className="text-xs text-muted-foreground">
            Default borrowing window.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-active-loans">Max Active Loans</Label>
          <Input
            id="max-active-loans"
            type="number"
            min="1"
            max="50"
            value={maxActiveLoans}
            onChange={(e) => setMaxActiveLoans(Number(e.target.value))}
            required
          />
          <p className="text-xs text-muted-foreground">
            Concurrent limit per student.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-expiry">Reservation Hold (Days)</Label>
          <Input
            id="reservation-expiry"
            type="number"
            min="1"
            max="90"
            value={reservationExpiryDays}
            onChange={(e) => setReservationExpiryDays(Number(e.target.value))}
            required
          />
          <p className="text-xs text-muted-foreground">
            Window before hold expires.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-renewals">Maximum Renewals per Loan</Label>
          <Input
            id="max-renewals"
            type="number"
            min="0"
            max="5"
            value={maxRenewals}
            onChange={(e) => setMaxRenewals(Number(e.target.value))}
            required
          />
          <p className="text-xs text-muted-foreground">
            Set to 0 to turn off renewals. Default: 1.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Policy Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDailyFineRate(String(policy.daily_overdue_fine_rate));
            setMaxFineAmount(String(policy.max_fine_amount));
            setLoanPeriodDays(policy.loan_period_days);
            setMaxActiveLoans(policy.max_active_loans);
            setMaxRenewals(policy.max_renewals);
            setReservationExpiryDays(policy.reservation_expiry_days);
            setClientError(null);
          }}
          disabled={isPending}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}

export function CirculationPolicyPage() {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);

  const policyQuery = useQuery({
    queryKey: ["circulation-policy"],
    queryFn: getCirculationPolicy,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CirculationPolicyUpdate) => updateCirculationPolicy(payload),
    onSuccess: (data) => {
      appToast.success("Circulation policy updated successfully");
      queryClient.setQueryData(["circulation-policy"], data);
      setApiError(null);
    },
    onError: (error) => {
      setApiError(getApiErrorMessage(error, "Failed to update circulation policy."));
    },
  });

  if (policyQuery.isError) {
    return (
      <section className="space-y-6">
        <CatalogPageHeader
          title="Circulation Policy"
          description="Configure fine rates, loan durations, and borrowing limits for library patrons."
        />
        <QueryErrorState
          onRetry={() => policyQuery.refetch()}
          message={getApiErrorMessage(policyQuery.error, "Failed to load active circulation policy.")}
        />
      </section>
    );
  }

  const policy = policyQuery.data;

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title="Circulation Policy"
        description="Configure fine rates, loan durations, and borrowing limits for library patrons."
      />

      {policy?.updated_by_user ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
          <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-medium">Audit History</p>
            <p className="text-muted-foreground text-xs">
              Last updated by{" "}
              <span className="font-medium text-foreground">
                {policy.updated_by_user.first_name} {policy.updated_by_user.last_name}
              </span>{" "}
              ({policy.updated_by_user.email}) on {formatDate(policy.updated_at)}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
                Operational Rules
              </CardTitle>
              <CardDescription>
                Updates take effect immediately on subsequent book issues, returns, and reservations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {policyQuery.isLoading || !policy ? (
                <div className="space-y-5" aria-busy="true" aria-label="Loading active policy">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-9 w-36" />
                    <Skeleton className="h-9 w-20" />
                  </div>
                </div>
              ) : (
                <CirculationPolicyForm
                  key={policy.updated_at}
                  policy={policy}
                  isPending={updateMutation.isPending}
                  onSubmit={(payload) => updateMutation.mutate(payload)}
                  apiError={apiError}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Policy Guidelines</CardTitle>
              <CardDescription>
                How circulation rules interact across library workflows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Late Returns & Fines</p>
                <p>
                  Fines are assessed when a book is returned past its UTC calendar due date.
                  Calculation: <code className="text-foreground">days_late × rate</code> clamped to the Maximum Fine Cap ({formatInr(policy?.max_fine_amount ?? 500)}).
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Borrowing Blocks</p>
                <p>
                  Students with any unpaid fine cannot issue new books. Once collected by staff, borrowing privileges are restored immediately.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Loan Limits</p>
                <p>
                  Limits students to at most {policy?.max_active_loans ?? 5} concurrent open loans across all catalog copies.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Reservation Holds</p>
                <p>
                  When a reserved book is returned, it is set to <code>RESERVED</code> and held for the first queued student for {policy?.reservation_expiry_days ?? 7} days.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Loan Renewals</p>
                <p>
                  Students may renew an active, non-overdue loan up to {policy?.max_renewals ?? 1} time{(policy?.max_renewals ?? 1) === 1 ? "" : "s"} if nobody is waiting for the book and they have no unpaid fines. Each renewal extends the current due date by the standard loan period.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
