import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useDebouncedValue } from "@/lib/hooks";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { getApiErrorMessage } from "@/lib/apiError";
import { appToast } from "@/lib/toast";
import { ReservationQueueWarning } from "@/pages/circulation/components/ReservationQueueWarning";
import {
  formatReservationStudentLabel,
} from "@/pages/circulation/components/reservationQueueUtils";
import { CirculationPageHeader } from "@/pages/circulation/components/CirculationShared";
import {
  getReservationQueue,
  issueBook,
  listAvailableCopies,
  listTransactions,
  searchStudents,
} from "@/services/circulation";
import type { AvailableCopyResult, StudentSearchResult } from "@/types/circulation";

interface IssuePageLocationState {
  bookId?: string;
  copyId?: string;
  studentId?: string;
  student?: StudentSearchResult;
}

function formatStudentLabel(student: StudentSearchResult): string {
  return `${student.first_name} ${student.last_name} (${student.student_code ?? student.email})`;
}

export function IssueBookPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = (location.state as IssuePageLocationState | null) ?? null;

  const [studentSearch, setStudentSearch] = useState("");
  const [copySearch, setCopySearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<AvailableCopyResult | null>(null);
  const [showIssueConfirm, setShowIssueConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debouncedStudentSearch = useDebouncedValue(studentSearch.trim(), 300);
  const debouncedCopySearch = useDebouncedValue(copySearch.trim(), 300);

  const studentsQuery = useQuery({
    queryKey: ["circulation", "students", debouncedStudentSearch],
    queryFn: () => searchStudents(debouncedStudentSearch),
    enabled: debouncedStudentSearch.length >= 2,
  });

  const copiesQuery = useQuery({
    queryKey: ["circulation", "copies", "available", locationState?.bookId, debouncedCopySearch],
    queryFn: () =>
      listAvailableCopies({
        ...(locationState?.bookId ? { book_id: locationState.bookId } : {}),
        ...(debouncedCopySearch ? { q: debouncedCopySearch } : {}),
      }),
  });
  const copySearchSettled = copySearch.trim() === debouncedCopySearch;

  const studentLoansQuery = useQuery({
    queryKey: ["transactions", "student-active", selectedStudent?.id],
    queryFn: () =>
      listTransactions({
        student_id: selectedStudent!.id,
        status: "ISSUED",
        page: 1,
        page_size: 100,
      }),
    enabled: Boolean(selectedStudent?.id),
  });

  const queueQuery = useQuery({
    queryKey: ["reservations", "queue", selectedCopy?.book_id],
    queryFn: () => getReservationQueue(selectedCopy!.book_id),
    enabled: Boolean(selectedCopy?.book_id),
  });

  const [lastAppliedLocationState, setLastAppliedLocationState] =
    useState<IssuePageLocationState | null>(null);
  if (
    locationState &&
    locationState !== lastAppliedLocationState &&
    copiesQuery.data
  ) {
    if (locationState.copyId) {
      const copy = copiesQuery.data.find((item) => item.id === locationState.copyId);
      if (copy) {
        setSelectedCopy(copy);
        setCopySearch(copy.book_title);
      }
    }

    if (locationState.student) {
      setSelectedStudent(locationState.student);
      setStudentSearch(locationState.student.student_code ?? locationState.student.email);
    }

    setLastAppliedLocationState(locationState);
  }

  const studentSearchSettled = studentSearch.trim() === debouncedStudentSearch;
  const matchingStudents = studentSearchSettled ? (studentsQuery.data ?? []) : [];

  // Server already filters by `q` (title / inventory code); the list below
  // is grouped by book so multiple copies of one title read as one group.
  const availableCopies = useMemo(
    () => (copySearchSettled ? (copiesQuery.data ?? []) : []),
    [copySearchSettled, copiesQuery.data],
  );

  const groupedCopies = useMemo(() => {
    const groups = new Map<string, { book_id: string; book_title: string; copies: typeof availableCopies }>();
    for (const copy of availableCopies) {
      const group = groups.get(copy.book_id) ?? {
        book_id: copy.book_id,
        book_title: copy.book_title,
        copies: [],
      };
      group.copies.push(copy);
      groups.set(copy.book_id, group);
    }
    return [...groups.values()].sort((a, b) => a.book_title.localeCompare(b.book_title));
  }, [availableCopies]);

  const duplicateLoan = useMemo(() => {
    if (!selectedStudent || !selectedCopy) {
      return false;
    }
    const items = studentLoansQuery.data?.items ?? [];
    return items.some((item) => item.book_copy.book_id === selectedCopy.book_id);
  }, [selectedStudent, selectedCopy, studentLoansQuery.data]);

  const issueMutation = useMutation({
    mutationFn: ({ bypass }: { bypass: boolean }) =>
      issueBook({
        student_id: selectedStudent!.id,
        book_copy_id: selectedCopy!.id,
        bypass_reservation: bypass || undefined,
      }),
    onSuccess: (transaction) => {
      appToast.issued(
        `Issued ${transaction.book_copy.inventory_code} to ${transaction.student.first_name} ${transaction.student.last_name}`,
      );
      setErrorMessage(null);
      setShowIssueConfirm(false);
      setSelectedStudent(null);
      setSelectedCopy(null);
      setStudentSearch("");
      setCopySearch("");
      queryClient.invalidateQueries({ queryKey: ["circulation", "copies"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (error) => {
      setShowIssueConfirm(false);
      setErrorMessage(getApiErrorMessage(error, "Unable to issue book."));
    },
  });

  const activeQueue = queueQuery.data ?? [];
  const nextReservation = activeQueue[0];
  const selectedStudentIsQueueHead = Boolean(
    selectedStudent && nextReservation && nextReservation.student.id === selectedStudent.id,
  );

  const handleIssueClick = () => {
    if (
      !selectedStudent ||
      !selectedCopy ||
      duplicateLoan ||
      queueQuery.isLoading ||
      queueQuery.isError ||
      studentLoansQuery.isLoading ||
      studentLoansQuery.isError
    ) {
      return;
    }
    if (activeQueue.length && !selectedStudentIsQueueHead) {
      setShowIssueConfirm(true);
      return;
    }
    issueMutation.mutate({ bypass: false });
  };

  return (
    <section className="space-y-6">
      <CirculationPageHeader
        title="Issue Book"
        description="Select a student and an available copy to create a loan."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-search">Student</Label>
              <Input
                id="student-search"
                value={studentSearch}
                onChange={(event) => {
                  setStudentSearch(event.target.value);
                  setSelectedStudent(null);
                  setSelectedCopy(null);
                  setCopySearch("");
                }}
                placeholder="Search by name, email, or student code"
                autoComplete="off"
              />
              <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                {studentsQuery.isLoading
                  ? "Loading students..."
                  : !studentSearchSettled
                    ? "Searching students..."
                    : debouncedStudentSearch.length < 2
                    ? "Enter at least 2 characters to search students."
                    : `Showing up to 20 matching students. ${matchingStudents.length} found.`}
              </p>
              {studentsQuery.isError ? (
                <QueryErrorState
                  message="Unable to search students."
                  onRetry={() => void studentsQuery.refetch()}
                />
              ) : matchingStudents.length ? (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border/70 bg-card/60">
                  {matchingStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className={[
                        "block min-h-10 w-full px-3 py-2.5 text-left text-sm hover:bg-muted",
                        selectedStudent?.id === student.id ? "bg-muted font-medium" : "",
                      ].join(" ")}
                      aria-pressed={selectedStudent?.id === student.id}
                      onClick={() => setSelectedStudent(student)}
                    >
                      {formatStudentLabel(student)}
                    </button>
                  ))}
                </div>
              ) : studentSearchSettled &&
                debouncedStudentSearch.length >= 2 &&
                !studentsQuery.isLoading ? (
                <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  No active students match “{debouncedStudentSearch}”. Try a name, email, or student code.
                </p>
              ) : null}
              {selectedStudent ? (
                <p className="text-sm text-muted-foreground">
                  Selected: {formatStudentLabel(selectedStudent)}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="copy-search">Available copy</Label>
              <Input
                id="copy-search"
                value={copySearch}
                onChange={(event) => {
                  setCopySearch(event.target.value);
                  setSelectedCopy(null);
                }}
                placeholder="Filter by book title or inventory code"
              />
              <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                {copiesQuery.isLoading || !copySearchSettled
                  ? "Loading available copies..."
                  : debouncedCopySearch
                    ? `Showing up to 50 available copies matching “${debouncedCopySearch}”. Narrow your search if needed.`
                    : "Showing up to 50 available copies. Search to narrow the list. Only AVAILABLE copies are listed."}
              </p>
              {copiesQuery.isError ? (
                <QueryErrorState
                  message="Unable to load available copies."
                  onRetry={() => void copiesQuery.refetch()}
                />
              ) : copiesQuery.isLoading || !copySearchSettled ? (
                <p role="status" className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  Searching available copies…
                </p>
              ) : groupedCopies.length ? (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-border/70 bg-card/60">
                  {groupedCopies.map((group) => (
                    <div key={group.book_id} className="border-b last:border-b-0">
                      <p className="bg-secondary/55 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.book_title} · {group.copies.length}{" "}
                        {group.copies.length === 1 ? "copy" : "copies"} available
                      </p>
                      {group.copies.map((copy) => (
                        <button
                          key={copy.id}
                          type="button"
                          className={[
                            "block min-h-10 w-full px-3 py-2.5 text-left text-sm hover:bg-muted",
                            selectedCopy?.id === copy.id ? "bg-muted font-medium" : "",
                          ].join(" ")}
                          aria-pressed={selectedCopy?.id === copy.id}
                          onClick={() => setSelectedCopy(copy)}
                        >
                          <span className="font-medium">{copy.inventory_code}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {copy.location ?? "No location"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No available copies match your filter.</p>
              )}
              {selectedCopy ? (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedCopy.book_title} ({selectedCopy.inventory_code}
                  {selectedCopy.location ? ` · ${selectedCopy.location}` : ""})
                </p>
              ) : null}
            </div>
          </div>

          {selectedCopy && queueQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Checking reservation queue...</p>
          ) : null}

          {selectedCopy && queueQuery.isError ? (
            <QueryErrorState
              message="Unable to check the reservation queue. Retry before issuing this copy."
              onRetry={() => void queueQuery.refetch()}
            />
          ) : null}

          {selectedCopy && activeQueue.length ? (
            <ReservationQueueWarning queue={activeQueue} bookTitle={selectedCopy.book_title} />
          ) : null}

          {selectedStudent && selectedCopy && studentLoansQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Checking student&apos;s active loans...</p>
          ) : null}

          {selectedStudent && studentLoansQuery.isError ? (
            <QueryErrorState
              message="Unable to check this student’s current loans. Retry before issuing."
              onRetry={() => void studentLoansQuery.refetch()}
            />
          ) : null}

          {duplicateLoan && selectedStudent && selectedCopy ? (
            <p className="text-sm text-destructive">
              {selectedStudent.first_name} {selectedStudent.last_name} already holds an open loan
              for “{selectedCopy.book_title}”. Return it before issuing another copy.
            </p>
          ) : null}

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          <Button
            disabled={
              !selectedStudent ||
              !selectedCopy ||
              duplicateLoan ||
              issueMutation.isPending ||
              queueQuery.isLoading ||
              queueQuery.isError ||
              studentLoansQuery.isLoading ||
              studentLoansQuery.isError
            }
            onClick={handleIssueClick}
          >
            {issueMutation.isPending ? "Issuing..." : "Issue book"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showIssueConfirm} onOpenChange={setShowIssueConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservation queue warning</DialogTitle>
            <DialogDescription>
              This book has an active reservation queue. You may still issue the copy, but the next
              reserved student should normally receive it.
            </DialogDescription>
          </DialogHeader>
          {nextReservation && selectedStudent ? (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">Next reservation</dt>
                <dd className="mt-1">{formatReservationStudentLabel(nextReservation)}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">You are issuing this copy to</dt>
                <dd className="mt-1">{formatStudentLabel(selectedStudent)}</dd>
              </div>
            </dl>
          ) : null}
          <p className="text-sm text-muted-foreground">Proceed anyway?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssueConfirm(false)}>
              Cancel
            </Button>
            <Button
              disabled={issueMutation.isPending}
              onClick={() => issueMutation.mutate({ bypass: true })}
            >
              {issueMutation.isPending ? "Issuing..." : "Issue Anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
