import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { formatInr } from "@/lib/formatCurrency";
import { appToast } from "@/lib/toast";
import { CatalogPageHeader } from "@/pages/catalog/components/CatalogShared";
import { getCirculationPolicy, updateCirculationPolicy } from "@/services/admin";
import type { CirculationPolicyUpdate } from "@/types/circulationPolicy";

export function CirculationPolicyPage() {
  const queryClient = useQueryClient();

  const [dailyFineRate, setDailyFineRate] = useState<string>("10.00");
  const [maxFineAmount, setMaxFineAmount] = useState<string>("500.00");
  const [loanPeriodDays, setLoanPeriodDays] = useState<number>(14);
  const [maxActiveLoans, setMaxActiveLoans] = useState<number>(5);
  const [reservationExpiryDays, setReservationExpiryDays] = useState<number>(7);
  const [clientError, setClientError] = useState<string | null>(null);

  const policyQuery = useQuery({
    queryKey: ["circulation-policy"],
    queryFn: getCirculationPolicy,
  });

  useEffect(() => {
    if (policyQuery.data) {
      setDailyFineRate(String(policyQuery.data.daily_overdue_fine_rate));
      setMaxFineAmount(String(policyQuery.data.max_fine_amount));
      setLoanPeriodDays(policyQuery.data.loan_period_days);
      setMaxActiveLoans(policyQuery.data.max_active_loans);
      setReservationExpiryDays(policyQuery.data.reservation_expiry_days);
    }
  }, [policyQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: CirculationPolicyUpdate) => updateCirculationPolicy(payload),
    onSuccess: (data) => {
      appToast.success("Circulation policy updated successfully");
      queryClient.setQueryData(["circulation-policy"], data);
      setClientError(null);
    },
    onError: (error) => {
      setClientError(getApiErrorMessage(error, "Failed to update circulation policy."));
    },
  });

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

    updateMutation.mutate({
      daily_overdue_fine_rate: rateNum,
      max_fine_amount: capNum,
      loan_period_days: loanPeriodDays,
      max_active_loans: maxActiveLoans,
      reservation_expiry_days: reservationExpiryDays,
    });
  };

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
              {policyQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading active policy...</p>
              ) : (
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

                  <div className="grid gap-4 sm:grid-cols-3">
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
                  </div>

                  {clientError ? (
                    <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{clientError}</span>
                    </div>
                  ) : null}

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Saving..." : "Save Policy Changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (policy) {
                          setDailyFineRate(String(policy.daily_overdue_fine_rate));
                          setMaxFineAmount(String(policy.max_fine_amount));
                          setLoanPeriodDays(policy.loan_period_days);
                          setMaxActiveLoans(policy.max_active_loans);
                          setReservationExpiryDays(policy.reservation_expiry_days);
                          setClientError(null);
                        }
                      }}
                      disabled={updateMutation.isPending}
                    >
                      Reset
                    </Button>
                  </div>
                </form>
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
                  Calculation: <code className="text-foreground">days_late × rate</code> clamped to the Maximum Fine Cap ({formatInr(maxFineAmount)}).
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
                  Limits students to at most {maxActiveLoans} concurrent open loans across all catalog copies.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Reservation Holds</p>
                <p>
                  When a reserved book is returned, it is set to <code>RESERVED</code> and held for the first queued student for {reservationExpiryDays} days.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
