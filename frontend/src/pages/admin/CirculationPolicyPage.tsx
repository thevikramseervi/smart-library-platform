import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bookmark, ChevronDown, Info, ShieldAlert, SlidersHorizontal, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  const hasChanges =
    !dailyFineRate.trim() || Number(dailyFineRate) !== Number(policy.daily_overdue_fine_rate) ||
    !maxFineAmount.trim() || Number(maxFineAmount) !== Number(policy.max_fine_amount) ||
    loanPeriodDays !== policy.loan_period_days ||
    maxActiveLoans !== policy.max_active_loans ||
    maxRenewals !== policy.max_renewals ||
    reservationExpiryDays !== policy.reservation_expiry_days;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PolicyFieldGroup icon={Wallet} title="Fines" description="Daily accrual and per-loan limit.">
          <PolicyNumberField
            id="daily-fine-rate"
            label="Daily fine rate"
            value={dailyFineRate}
            onChange={setDailyFineRate}
            min={0}
            step="0.50"
            suffix="₹ / day"
            hint="Accrued for each overdue calendar day."
          />
          <PolicyNumberField
            id="max-fine-amount"
            label="Maximum fine"
            value={maxFineAmount}
            onChange={setMaxFineAmount}
            min={0}
            step="1.00"
            suffix="₹"
            hint="The fine for one loan cannot exceed this amount."
          />
        </PolicyFieldGroup>

        <PolicyFieldGroup icon={BookOpen} title="Loans" description="Due dates and student borrowing limits.">
          <PolicyNumberField
            id="loan-period"
            label="Loan period"
            value={loanPeriodDays}
            onChange={(value) => setLoanPeriodDays(Number(value))}
            min={1}
            max={365}
            suffix="days"
            hint="Default time before a book is due."
          />
          <PolicyNumberField
            id="max-active-loans"
            label="Maximum active loans"
            value={maxActiveLoans}
            onChange={(value) => setMaxActiveLoans(Number(value))}
            min={1}
            max={50}
            suffix="books"
            hint="Open loans allowed per student."
          />
        </PolicyFieldGroup>

        <PolicyFieldGroup icon={Bookmark} title="Reservations & renewals" description="Queue holds and loan extensions.">
          <PolicyNumberField
            id="reservation-expiry"
            label="Reservation hold"
            value={reservationExpiryDays}
            onChange={(value) => setReservationExpiryDays(Number(value))}
            min={1}
            max={90}
            suffix="days"
            hint="Time for the next student to collect a held copy."
          />
          <PolicyNumberField
            id="max-renewals"
            label="Renewals per loan"
            value={maxRenewals}
            onChange={(value) => setMaxRenewals(Number(value))}
            min={0}
            max={5}
            suffix="times"
            hint="Set to 0 to turn renewals off."
          />
        </PolicyFieldGroup>
      </div>

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className={`inline-flex items-center gap-2 text-sm ${hasChanges ? "font-medium text-amber-800" : "text-muted-foreground"}`}>
          <span className={`size-2 rounded-full ${hasChanges ? "bg-amber-500" : "bg-emerald-600"}`} aria-hidden="true" />
          {hasChanges ? "Unsaved changes" : "Policy is up to date"}
        </p>
        <div className="flex gap-2">
          {hasChanges ? (
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
              Discard changes
            </Button>
          ) : null}
          <Button type="submit" disabled={isPending || !hasChanges}>
            {isPending ? "Saving changes…" : "Save policy"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function PolicyFieldGroup({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full gap-0 overflow-hidden border-border/70 bg-background/80 py-0 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs leading-5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-4 py-4">{children}</CardContent>
    </Card>
  );
}

function PolicyNumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  hint,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  min: number;
  max?: number;
  step?: string;
  suffix: string;
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      <div className="flex h-11 w-full items-center overflow-hidden rounded-lg border border-input bg-background shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-hint`}
          className="h-full rounded-none border-0 bg-transparent text-base font-semibold tabular-nums shadow-none focus-visible:border-transparent focus-visible:ring-0"
          required
        />
        <span aria-hidden="true" className="inline-flex h-full shrink-0 items-center border-l border-input bg-muted/35 px-3 text-xs font-medium text-muted-foreground">
          {suffix}
        </span>
      </div>
      <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

function GuidelineCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/90 p-4">
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{children}</p>
    </div>
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
            <p className="font-medium">Last policy update</p>
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

      <Card className="border-primary/10 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
            Operational rules
          </CardTitle>
          <CardDescription>
            Updates apply to subsequent issues, returns, renewals, and reservations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policyQuery.isLoading || !policy ? (
            <div className="grid gap-6 sm:grid-cols-2" aria-busy="true" aria-label="Loading active policy">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-3 w-56" />
                </div>
              ))}
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

      <details className="group overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden [&::-webkit-details-marker]:hidden sm:px-6">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Info aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">How these rules work</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                See how the settings affect loans, fines, reservations, and renewals.
              </span>
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-border/70 bg-muted/15 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          <GuidelineCard title="Fines">
            Overdue charges accrue at {formatInr(policy?.daily_overdue_fine_rate ?? 10)} per day after the UTC due date, up to {formatInr(policy?.max_fine_amount ?? 500)} per loan. Accrual stops when the book is returned.
          </GuidelineCard>
          <GuidelineCard title="Borrowing limit">
            A student may have up to {policy?.max_active_loans ?? 5} open loans at once. Unpaid fines block new issues until staff records payment.
          </GuidelineCard>
          <GuidelineCard title="Reservation holds">
            A returned copy with a waiting queue is held for the first student in line for {policy?.reservation_expiry_days ?? 7} days.
          </GuidelineCard>
          <GuidelineCard title="Renewals">
            Loans last {policy?.loan_period_days ?? 14} days. Each renewal adds another loan period and is allowed only when the loan is not overdue, no student is waiting, and no fine is unpaid; the limit is {policy?.max_renewals ?? 1} renewal{(policy?.max_renewals ?? 1) === 1 ? "" : "s"}.
          </GuidelineCard>
        </div>
      </details>
    </section>
  );
}
