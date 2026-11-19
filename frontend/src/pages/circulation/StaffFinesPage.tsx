import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { IndianRupee } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { formatInr } from "@/lib/formatCurrency";
import { useDebouncedValue } from "@/lib/hooks";
import { appToast } from "@/lib/toast";
import {
  CirculationPageHeader,
  CirculationRecordCard,
  CirculationTable,
  CirculationTableHead,
  FineStatusBadge,
  PaginationControls,
} from "@/pages/circulation/components/CirculationShared";
import { listFines, listStudentFineBalances, markFinePaid } from "@/services/circulation";
import type { Fine, PaginatedResponse, StudentFineBalance } from "@/types/circulation";

export function StaffFinesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [payError, setPayError] = useState<string | null>(null);
  const [fineToPay, setFineToPay] = useState<Fine | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [view, setView] = useState<"records" | "students">("records");
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const queryClient = useQueryClient();

  const fineQuery = useQuery({
    queryKey: ["fines", page, pageSize, statusFilter, debouncedSearch, studentFilter],
    queryFn: () =>
      listFines({
        page,
        page_size: pageSize,
        paid: statusFilter === "all" ? undefined : statusFilter === "paid",
        student_id: studentFilter ?? undefined,
        q: debouncedSearch || undefined,
      }),
    enabled: view === "records",
  });
  const balanceQuery = useQuery({
    queryKey: ["fine-student-balances", page, pageSize, debouncedSearch],
    queryFn: () =>
      listStudentFineBalances({ page, page_size: pageSize, q: debouncedSearch || undefined }),
    enabled: view === "students",
  });

  const payMutation = useMutation({
    mutationFn: markFinePaid,
    onSuccess: () => {
      appToast.paid();
      setPayError(null);
      setFineToPay(null);
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      queryClient.invalidateQueries({ queryKey: ["fine-student-balances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      setPayError(getApiErrorMessage(error, "Unable to mark fine as paid."));
    },
  });

  return (
    <section className="space-y-6">
      <CirculationPageHeader title="Fines" description="Manage student overdue fines." />

      <Tabs
        value={view}
        className="space-y-6"
        onValueChange={(value) => {
          const nextView = value as typeof view;
          setView(nextView);
          setPage(1);
          if (nextView === "records") setStudentFilter(null);
        }}
      >
        <TabsList aria-label="Fine views" className="w-fit max-w-full">
          <TabsTrigger value="records">Fine records</TabsTrigger>
          <TabsTrigger value="students">By student</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="space-y-2">
              <Label htmlFor="fine-search">Search fines</Label>
              <Input
                id="fine-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  setStudentFilter(null);
                }}
                placeholder="Search by student, book, email, or copy code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fine-status">Payment status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as typeof statusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger id="fine-status" aria-label="Payment status" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All fines</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {payError ? <p className="text-sm text-destructive">{payError}</p> : null}
          {fineQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading fines...</p>
          ) : fineQuery.isError ? (
            <QueryErrorState
              message="Unable to load fines."
              onRetry={() => void fineQuery.refetch()}
            />
          ) : fineQuery.data?.items.length ? (
            <>
              <CirculationTable
                mobileContent={fineQuery.data.items.map((fine) => (
                  <CirculationRecordCard
                    key={fine.id}
                    title={fine.student_name}
                    subtitle={fine.student_code}
                    status={<FineStatusBadge paid={fine.paid} />}
                    fields={[
                      {
                        label: "Book / copy",
                        value: (
                          <>
                            {fine.book_title}
                            <span className="block text-xs text-muted-foreground">
                              {fine.inventory_code}
                            </span>
                          </>
                        ),
                      },
                      { label: "Due date", value: formatDate(fine.due_at) },
                      { label: "Amount", value: formatInr(fine.amount) },
                      { label: "Reason", value: fine.reason, wide: true },
                      {
                        label: "Payment details",
                        value: fine.paid_at
                          ? `Paid ${formatDate(fine.paid_at)}`
                          : fine.is_accruing
                            ? fine.is_capped
                              ? "Maximum fine reached"
                              : "Accruing until returned"
                            : "—",
                        wide: true,
                      },
                    ]}
                    action={
                      !fine.paid && !fine.is_accruing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={payMutation.isPending}
                          onClick={() => setFineToPay(fine)}
                        >
                          Mark paid
                        </Button>
                      ) : fine.is_accruing ? (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to="/circulation/return"
                            state={{ inventoryCode: fine.inventory_code }}
                          >
                            Start return
                          </Link>
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              >
                <CirculationTableHead
                  columns={[
                    "Student",
                    "Book / copy",
                    "Due date",
                    "Amount",
                    "Reason",
                    "Status",
                    "Actions",
                  ]}
                />
                <tbody>
                  {fineQuery.data.items.map((fine) => (
                    <tr key={fine.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{fine.student_name}</p>
                        {fine.student_code ? (
                          <p className="text-xs text-muted-foreground">{fine.student_code}</p>
                        ) : null}
                      </td>
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
                        {fine.is_accruing ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {fine.is_capped ? "Maximum fine reached" : "Accruing until returned"}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {!fine.paid && !fine.is_accruing ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={payMutation.isPending}
                            onClick={() => setFineToPay(fine)}
                          >
                            Mark paid
                          </Button>
                        ) : fine.is_accruing ? (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              to="/circulation/return"
                              state={{ inventoryCode: fine.inventory_code }}
                            >
                              Start return
                            </Link>
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CirculationTable>
              {fineQuery.data ? (
                <PaginationControls
                  page={fineQuery.data.page}
                  totalPages={fineQuery.data.total_pages}
                  total={fineQuery.data.total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : null}
            </>
          ) : (
            <EmptyState
              message={
                search.trim()
                  ? "No fines match your search and status filter."
                  : statusFilter === "paid"
                    ? "There are no paid fines."
                    : statusFilter === "unpaid"
                      ? "There are no unpaid fines."
                      : "No fines have been recorded."
              }
              icon={IndianRupee}
            />
          )}
        </TabsContent>

        <TabsContent value="students" className="mt-0 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fine-student-search">Search students</Label>
            <Input
              id="fine-student-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setStudentFilter(null);
              }}
              placeholder="Search by student name, code, or email"
            />
          </div>
          <StudentBalanceView
            data={balanceQuery.data}
            isLoading={balanceQuery.isLoading}
            isError={balanceQuery.isError}
            search={search}
            pageSize={pageSize}
            onRetry={() => void balanceQuery.refetch()}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onViewStudent={(student) => {
              setStudentFilter(student.student_id);
              setStatusFilter("unpaid");
              setSearch("");
              setPage(1);
              setView("records");
            }}
          />
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={fineToPay !== null}
        onOpenChange={(open) => {
          if (!open && !payMutation.isPending) setFineToPay(null);
        }}
        title="Record fine payment?"
        description={
          fineToPay
            ? `Confirm that ${fineToPay.student_name} has paid ${formatInr(fineToPay.amount)} for ${fineToPay.book_title} (${fineToPay.inventory_code}). This records the fine as paid in the library account.`
            : "Confirm that the fine payment has been received."
        }
        confirmLabel="Confirm payment received"
        pending={payMutation.isPending}
        onConfirm={() => {
          if (fineToPay) payMutation.mutate(fineToPay.id);
        }}
      />
    </section>
  );
}

interface StudentBalanceViewProps {
  data: PaginatedResponse<StudentFineBalance> | undefined;
  isLoading: boolean;
  isError: boolean;
  search: string;
  pageSize: number;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onViewStudent: (student: StudentFineBalance) => void;
}

function StudentBalanceView({
  data,
  isLoading,
  isError,
  search,
  pageSize,
  onRetry,
  onPageChange,
  onPageSizeChange,
  onViewStudent,
}: StudentBalanceViewProps) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading student balances...</p>;
  if (isError) {
    return <QueryErrorState message="Unable to load student fine balances." onRetry={onRetry} />;
  }
  if (!data?.items.length) {
    return (
      <EmptyState
        message={
          search.trim()
            ? "No students with outstanding fines match your search."
            : "No students have outstanding fines."
        }
        icon={IndianRupee}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Balances include unpaid fines on overdue books that haven’t been returned. Accruing
        amounts may rise until return, up to the policy cap.
      </p>
      <CirculationTable
        mobileContent={data.items.map((student) => (
          <CirculationRecordCard
            key={student.student_id}
            title={student.student_name}
            subtitle={student.student_code}
            status={
              <span className="font-semibold text-destructive">
                {formatInr(student.total_outstanding)} outstanding
              </span>
            }
            fields={[
              {
                label: "Still accruing",
                value: `${formatInr(student.accruing_amount)} · ${student.accruing_fine_count} overdue ${student.accruing_fine_count === 1 ? "loan" : "loans"}`,
              },
              { label: "Finalized, unpaid", value: formatInr(student.finalized_unpaid_amount) },
              { label: "Unpaid fines", value: student.unpaid_fine_count },
            ]}
            action={
              <Button variant="outline" size="sm" onClick={() => onViewStudent(student)}>
                View unpaid fines
              </Button>
            }
          />
        ))}
      >
        <CirculationTableHead
          columns={[
            "Student",
            "Outstanding now",
            "Still accruing",
            "Finalized, unpaid",
            "Unpaid fines",
            "Actions",
          ]}
        />
        <tbody>
          {data.items.map((student) => (
            <tr key={student.student_id} className="border-b last:border-b-0">
              <td className="px-4 py-3">
                <p className="font-medium">{student.student_name}</p>
                <p className="text-xs text-muted-foreground">
                  {student.student_code}
                </p>
              </td>
              <td className="px-4 py-3 font-semibold text-destructive">
                {formatInr(student.total_outstanding)}
              </td>
              <td className="px-4 py-3">
                <p>{formatInr(student.accruing_amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {student.accruing_fine_count} overdue{" "}
                  {student.accruing_fine_count === 1 ? "loan" : "loans"} not returned
                </p>
              </td>
              <td className="px-4 py-3">{formatInr(student.finalized_unpaid_amount)}</td>
              <td className="px-4 py-3">{student.unpaid_fine_count}</td>
              <td className="px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => onViewStudent(student)}>
                  View unpaid fines
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </CirculationTable>
      <PaginationControls
        page={data.page}
        totalPages={data.total_pages}
        total={data.total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
