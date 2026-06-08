import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatInr } from "@/lib/formatCurrency";
import { appToast } from "@/lib/toast";
import {
  CirculationPageHeader,
  CirculationTable,
  CirculationTableHead,
  FineStatusBadge,
  PaginationControls,
  formatDate,
} from "@/pages/circulation/components/CirculationShared";
import { listFines, markFinePaid } from "@/services/circulation";

export function StaffFinesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [payError, setPayError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fines", page, pageSize],
    queryFn: () => listFines({ page, page_size: pageSize }),
  });

  const payMutation = useMutation({
    mutationFn: markFinePaid,
    onSuccess: () => {
      appToast.paid();
      setPayError(null);
      queryClient.invalidateQueries({ queryKey: ["fines"] });
    },
    onError: (error) => {
      setPayError(getApiErrorMessage(error, "Unable to mark fine as paid."));
    },
  });

  return (
    <section className="space-y-6">
      <CirculationPageHeader title="Fines" description="Manage student overdue fines." />

      {payError ? <p className="text-sm text-destructive">{payError}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading fines...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load fines.</p>
      ) : (
        <>
          <CirculationTable>
            <CirculationTableHead columns={["Amount", "Reason", "Created", "Status", "Actions"]} />
            <tbody>
              {data?.items.map((fine) => (
                <tr key={fine.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{formatInr(fine.amount)}</td>
                  <td className="px-4 py-3">{fine.reason}</td>
                  <td className="px-4 py-3">{formatDate(fine.created_at)}</td>
                  <td className="px-4 py-3">
                    <FineStatusBadge paid={fine.paid} />
                  </td>
                  <td className="px-4 py-3">
                    {!fine.paid ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={payMutation.isPending}
                        onClick={() => payMutation.mutate(fine.id)}
                      >
                        Mark paid
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </CirculationTable>
          {data ? (
            <PaginationControls
              page={data.page}
              totalPages={data.total_pages}
              total={data.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
