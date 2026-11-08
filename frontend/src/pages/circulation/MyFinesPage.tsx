import { useQuery } from "@tanstack/react-query";
import { IndianRupee } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/ui/query-error-state";
import {
  CirculationPageHeader,
  CirculationRecordCard,
  CirculationTable,
  CirculationTableHead,
  FineStatusBadge,
} from "@/pages/circulation/components/CirculationShared";
import { formatInr } from "@/lib/formatCurrency";
import { formatDate } from "@/lib/format";
import { listMyFines } from "@/services/circulation";

export function MyFinesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fines", "me"],
    queryFn: listMyFines,
  });
  const outstandingCents = (data ?? []).reduce((total, fine) => {
    if (fine.paid) return total;
    const amountCents = Math.round(Number(fine.amount) * 100);
    return total + (Number.isFinite(amountCents) ? amountCents : 0);
  }, 0);
  const hasAccruingFine = data?.some((fine) => !fine.paid && fine.is_accruing) ?? false;

  return (
    <section className="space-y-6">
      <CirculationPageHeader
        title="My Fines"
        description="Overdue balances accrue until the book is returned. Contact the circulation desk to settle a finalized fine; staff record payment, and unpaid fines block new borrowing."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading fines...</p>
      ) : isError ? (
        <QueryErrorState message="Unable to load fines." onRetry={() => void refetch()} />
      ) : data?.length ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total outstanding</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatInr(outstandingCents / 100)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasAccruingFine
                  ? "Includes overdue books that have not yet been returned."
                  : "Total of all unpaid fines on your account."}
              </p>
            </div>
          </div>

          <CirculationTable
            recordCount={data.length}
            mobileContent={data.map((fine) => (
              <CirculationRecordCard
                key={fine.id}
                title={fine.book_title}
                subtitle={fine.inventory_code}
                status={<FineStatusBadge paid={fine.paid} />}
                fields={[
                  { label: "Due date", value: formatDate(fine.due_at) },
                  { label: "Amount", value: formatInr(fine.amount) },
                  { label: "Reason", value: fine.reason, wide: true },
                  { label: "Payment details", value: fine.paid_at ? `Paid ${formatDate(fine.paid_at)}` : !fine.paid && fine.is_capped ? "Maximum fine reached" : !fine.paid && fine.is_accruing ? "Accruing until returned" : "—", wide: true },
                ]}
              />
            ))}
          >
            <CirculationTableHead columns={["Book / copy", "Due date", "Amount", "Reason", "Status"]} />
            <tbody>
              {data.map((fine) => (
                <tr key={fine.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{fine.book_title}</p>
                    <p className="text-xs text-muted-foreground">{fine.inventory_code}</p>
                  </td>
                  <td className="px-4 py-3">{formatDate(fine.due_at)}</td>
                  <td className="px-4 py-3">{formatInr(fine.amount)}</td>
                  <td className="px-4 py-3">{fine.reason}</td>
                  <td className="px-4 py-3">
                    <FineStatusBadge paid={fine.paid} />
                    {fine.paid_at ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Paid {formatDate(fine.paid_at)}
                      </p>
                    ) : null}
                    {!fine.paid && (fine.is_capped || fine.is_accruing) ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fine.is_capped ? "Maximum fine reached" : "Accruing until returned"}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
        </div>
      ) : (
        <EmptyState
          message="Great! You have no outstanding fines."
          icon={IndianRupee}
        />
      )}
    </section>
  );
}
