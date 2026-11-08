import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookCopy, Check, LoaderCircle, MapPin, Search, UserRound } from "lucide-react";
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
import { getBookCopy } from "@/services/catalog/book-copies";
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
  bookTitle?: string;
}

interface SelectableCopy extends AvailableCopyResult {
  isReservedForQueue?: boolean;
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
  const [selectedCopy, setSelectedCopy] = useState<SelectableCopy | null>(null);
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
  const locationStudentId = locationState?.student?.id ?? locationState?.studentId;
  const reservedCopyQuery = useQuery({
    queryKey: ["circulation", "copies", "reserved", locationState?.copyId, locationStudentId],
    queryFn: () => getBookCopy(locationState!.copyId!),
    enabled: Boolean(locationState?.copyId && locationStudentId),
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
    copiesQuery.data &&
    (!locationState.copyId || !locationStudentId || reservedCopyQuery.isFetched)
  ) {
    if (locationState.copyId) {
      const copy = copiesQuery.data.find((item) => item.id === locationState.copyId);
      if (copy) {
        setSelectedCopy(copy);
        setCopySearch(copy.book_title);
      } else if (
        locationState.student &&
        locationState.student.id === locationStudentId &&
        locationState.bookId &&
        reservedCopyQuery.data?.status === "RESERVED" &&
        reservedCopyQuery.data.book_id === locationState.bookId
      ) {
        const reservedCopy: SelectableCopy = {
          id: reservedCopyQuery.data.id,
          book_id: reservedCopyQuery.data.book_id,
          book_title: locationState.bookTitle ?? "Reserved book",
          inventory_code: reservedCopyQuery.data.inventory_code,
          location: reservedCopyQuery.data.location,
          isReservedForQueue: true,
        };
        setSelectedCopy(reservedCopy);
        setCopySearch(reservedCopy.book_title);
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
  const reservedCopyBlocked = Boolean(
    selectedCopy?.isReservedForQueue &&
      activeQueue.length > 0 &&
      !selectedStudentIsQueueHead,
  );
  const readyToReview = Boolean(selectedStudent && selectedCopy);

  const handleIssueClick = () => {
    if (
      !selectedStudent ||
      !selectedCopy ||
      duplicateLoan ||
      reservedCopyBlocked ||
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
    <section className="mx-auto max-w-6xl space-y-6 pb-4">
      <CirculationPageHeader
        title="Issue Book"
        description="Choose who is borrowing and which copy they’re taking."
      />

      <div
        aria-label="Issue progress"
        className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-sm"
        role="group"
      >
        {[
          {
            label: "Student",
            detail: selectedStudent ? "Selected" : "Choose when ready",
            complete: Boolean(selectedStudent),
            Icon: UserRound,
          },
          {
            label: "Copy",
            detail: selectedCopy ? "Selected" : "Choose when ready",
            complete: Boolean(selectedCopy),
            Icon: BookCopy,
          },
          {
            label: "Review",
            detail: readyToReview ? "Ready to issue" : "Select both first",
            complete: readyToReview,
            Icon: Check,
          },
        ].map((step) => (
          <div
            key={step.label}
            className={`flex min-w-0 items-center gap-2 border-r border-border/60 px-3 py-3 last:border-r-0 sm:gap-3 sm:px-5 ${
              step.complete ? "bg-primary/[0.045]" : ""
            }`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                step.complete
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <step.Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold sm:text-sm">{step.label}</span>
              <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {step.detail}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="flex grid-cols-[1fr_auto] items-center gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-base">Choose a student</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Search by name, email, or student code</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="student-search">Student</Label>
              <Input
                id="student-search"
                value={studentSearch}
                onChange={(event) => {
                  setStudentSearch(event.target.value);
                  setSelectedStudent(null);
                  if (selectedCopy?.isReservedForQueue) {
                    setSelectedCopy(null);
                    setCopySearch("");
                  }
                }}
                placeholder="e.g. Vikram, email, or student code"
                autoComplete="off"
              />
              {!studentsQuery.isError ? (
                <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
                  {studentsQuery.isLoading || !studentSearchSettled
                    ? ""
                    : debouncedStudentSearch.length < 2
                      ? "Type at least 2 characters to search."
                      : matchingStudents.length
                        ? `${matchingStudents.length} matching ${matchingStudents.length === 1 ? "student" : "students"}`
                        : ""}
                </p>
              ) : null}
            </div>

            {studentsQuery.isError ? (
              <QueryErrorState
                message="Unable to search students."
                onRetry={() => void studentsQuery.refetch()}
              />
            ) : selectedStudent ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {selectedStudent.first_name.charAt(0)}{selectedStudent.last_name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedStudent.student_code ?? selectedStudent.email} · Selected
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentSearch("");
                    if (selectedCopy?.isReservedForQueue) {
                      setSelectedCopy(null);
                      setCopySearch("");
                    }
                  }}
                >
                  Change
                </Button>
              </div>
            ) : studentsQuery.isLoading || !studentSearchSettled ? (
              <div role="status" className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/30 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Searching students…
              </div>
            ) : matchingStudents.length ? (
              <div className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/70 bg-card/70">
                {matchingStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary/[0.045] focus-visible:bg-primary/[0.06] focus-visible:outline-none"
                    aria-pressed={false}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                      {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {student.first_name} {student.last_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {student.student_code ?? student.email}
                      </span>
                    </span>
                    <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : studentSearchSettled && debouncedStudentSearch.length >= 2 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-center">
                <UserRound aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No student found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try another name, email, or student code.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-center">
                <UserRound aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Find a student</p>
                <p className="mt-1 text-xs text-muted-foreground">Start typing to see matching library accounts.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="flex grid-cols-[1fr_auto] items-center gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <BookCopy aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-base">Choose a copy</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reservation priority is checked before issuing
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="copy-search">Search books and copies</Label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="copy-search"
                  className="h-11 rounded-xl bg-background pl-10 shadow-sm"
                  value={copySearch}
                  onChange={(event) => {
                    setCopySearch(event.target.value);
                    setSelectedCopy(null);
                  }}
                  placeholder="Type a title or inventory code"
                />
              </div>
              {!copiesQuery.isError ? (
                <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
                  {copiesQuery.isLoading || !copySearchSettled
                    ? ""
                    : debouncedCopySearch
                      ? copiesQuery.data?.length
                        ? `Showing ${copiesQuery.data.length} matching ${copiesQuery.data.length === 1 ? "copy" : "copies"}.`
                        : ""
                      : "Showing up to 50 available copies. Search to narrow the list."}
                </p>
              ) : null}
            </div>

            {copiesQuery.isError ? (
              <QueryErrorState
                message="Unable to load available copies."
                onRetry={() => void copiesQuery.refetch()}
              />
            ) : selectedCopy ? (
              <div className="overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-sm">
                <div className="flex items-center gap-3 p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookCopy aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <Check aria-hidden="true" className="size-3" />
                      Copy selected
                    </span>
                    <p className="truncate text-sm font-semibold">{selectedCopy.book_title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {selectedCopy.inventory_code}
                      {selectedCopy.location ? ` · ${selectedCopy.location}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCopy(null);
                      setCopySearch("");
                    }}
                  >
                    Change
                  </Button>
                </div>
                <div className="flex items-center gap-2 border-t border-primary/10 bg-white/35 px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  {selectedCopy.isReservedForQueue ? "Reserved for the queue head" : "Available copy"}
                </div>
              </div>
            ) : copiesQuery.isLoading || !copySearchSettled ? (
              <div role="status" className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/30 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Finding available copies…
              </div>
            ) : groupedCopies.length ? (
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-muted/25 p-2.5">
                {groupedCopies.map((group) => (
                  <section
                    key={group.book_id}
                    className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5 border-b border-border/60 bg-secondary/35 px-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
                        <BookCopy aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{group.book_title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {group.copies.length} {debouncedCopySearch ? "matching " : "shown "}
                          {group.copies.length === 1 ? "copy" : "copies"}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                        In stock
                      </span>
                    </div>
                    <div className="divide-y divide-border/50 px-2">
                      {group.copies.map((copy) => (
                        <button
                          key={copy.id}
                          type="button"
                          className="group flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-primary/[0.045] focus-visible:bg-primary/[0.06] focus-visible:outline-none"
                          aria-pressed={false}
                          onClick={() => setSelectedCopy(copy)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Copy code
                            </span>
                            <span className="mt-0.5 block truncate text-sm font-semibold">
                              {copy.inventory_code}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPin aria-hidden="true" className="size-3 shrink-0" />
                              {copy.location ?? "Location not set"}
                            </span>
                          </span>
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                            <ArrowRight aria-hidden="true" className="size-4" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-center">
                <BookCopy aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No available copies found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try another title or inventory code.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedCopy && queueQuery.isError ? (
        <QueryErrorState
          message="Unable to check the reservation queue. Retry before issuing this copy."
          onRetry={() => void queueQuery.refetch()}
        />
      ) : null}

      {selectedCopy && activeQueue.length ? (
        <ReservationQueueWarning queue={activeQueue} bookTitle={selectedCopy.book_title} />
      ) : null}

      {reservedCopyBlocked && nextReservation ? (
        <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This copy is reserved for {formatReservationStudentLabel(nextReservation)}. Select that student to issue it.
        </p>
      ) : null}

      {selectedStudent && selectedCopy && studentLoansQuery.isError ? (
        <QueryErrorState
          message="Unable to check this student’s current loans. Retry before issuing."
          onRetry={() => void studentLoansQuery.refetch()}
        />
      ) : null}

      {duplicateLoan && selectedStudent && selectedCopy ? (
        <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {selectedStudent.first_name} {selectedStudent.last_name} already has an open loan for “{selectedCopy.book_title}”. Return it before issuing another copy.
        </p>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Card className="gap-0 overflow-hidden border-primary/15 bg-card/90 py-0 shadow-md shadow-primary/[0.04]">
        <CardContent className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {selectedStudent && selectedCopy ? (
                <Check aria-hidden="true" className="size-5" />
              ) : (
                <BookCopy aria-hidden="true" className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {selectedStudent && selectedCopy ? "Ready to issue" : "Issue summary"}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {selectedStudent && selectedCopy
                  ? `${selectedStudent.first_name} ${selectedStudent.last_name} · ${selectedCopy.book_title} · ${selectedCopy.inventory_code}`
                  : "Choose a student and a copy to continue."}
              </p>
              {selectedStudent && selectedCopy && (queueQuery.isLoading || studentLoansQuery.isLoading) ? (
                <p role="status" className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
                  Checking borrowing rules…
                </p>
              ) : null}
            </div>
          </div>
          <Button
            className="w-full shrink-0 sm:w-auto"
            size="lg"
            disabled={
              !selectedStudent ||
              !selectedCopy ||
              duplicateLoan ||
              reservedCopyBlocked ||
              issueMutation.isPending ||
              queueQuery.isLoading ||
              queueQuery.isError ||
              studentLoansQuery.isLoading ||
              studentLoansQuery.isError
            }
            onClick={handleIssueClick}
          >
            {issueMutation.isPending ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" />
                Issuing…
              </>
            ) : (
              <>
                Issue book
                <ArrowRight aria-hidden="true" />
              </>
            )}
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
