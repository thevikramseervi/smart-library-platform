import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  CirculationPageHeader,
  CirculationTable,
  CirculationTableHead,
  FineStatusBadge,
  formatDate,
} from "@/pages/circulation/components/CirculationShared";
import { formatInr } from "@/lib/formatCurrency";
import { listMyFines } from "@/services/circulation";

export function MyFinesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["fines", "me"],
    queryFn: listMyFines,
  });

  return (
    <section className="space-y-6">
      <CirculationPageHeader
        title="My Fines"
        description="Overdue fines on your account. Unpaid fines block new borrowing."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading fines...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load fines.</p>
      ) : data?.length ? (
        <CirculationTable recordCount={data.length}>
          <CirculationTableHead columns={["Amount", "Reason", "Created", "Status"]} />
          <tbody>
            {data.map((fine) => (
              <tr key={fine.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">{formatInr(fine.amount)}</td>
                <td className="px-4 py-3">{fine.reason}</td>
                <td className="px-4 py-3">{formatDate(fine.created_at)}</td>
                <td className="px-4 py-3">
                  <FineStatusBadge paid={fine.paid} />
                </td>
              </tr>
            ))}
          </tbody>
        </CirculationTable>
      ) : (
        <EmptyState
          message="Great! You have no outstanding fines."
          icon={CircleDollarSign}
        />
      )}
    </section>
  );
}
