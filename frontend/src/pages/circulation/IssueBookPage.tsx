import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

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
import { getApiErrorMessage } from "@/lib/apiError";
import { ReservationQueueWarning } from "@/pages/circulation/components/ReservationQueueWarning";
import {
  formatReservationStudentLabel,
} from "@/pages/circulation/components/reservationQueueUtils";
import { CirculationPageHeader } from "@/pages/circulation/components/CirculationShared";
import {
  getReservationQueue,
  issueBook,
  listAvailableCopies,
  searchStudents,
} from "@/services/circulation";
import type { AvailableCopyResult, StudentSearchResult } from "@/types/circulation";

interface IssuePageLocationState {
  bookId?: string;
  copyId?: string;
  studentId?: string;
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const studentsQuery = useQuery({
    queryKey: ["circulation", "students", "all"],
    queryFn: () => searchStudents(),
  });

  const copiesQuery = useQuery({
    queryKey: ["circulation", "copies", "all"],
    queryFn: () => listAvailableCopies(),
  });

  const queueQuery = useQuery({
    queryKey: ["reservations", "queue", selectedCopy?.book_id],
    queryFn: () => getReservationQueue(selectedCopy!.book_id),
    enabled: Boolean(selectedCopy?.book_id),
  });

  useEffect(() => {
    if (!locationState || !copiesQuery.data || !studentsQuery.data) {
      return;
    }

    if (locationState.copyId) {
      const copy = copiesQuery.data.find((item) => item.id === locationState.copyId);
      if (copy) {
        setSelectedCopy(copy);
        setCopySearch(copy.book_title);
      }
    }

    if (locationState.studentId) {
      const student = studentsQuery.data.find((item) => item.id === locationState.studentId);
      if (student) {
        setSelectedStudent(student);
        setStudentSearch(student.student_code ?? student.email);
      }
    }
  }, [locationState, copiesQuery.data, studentsQuery.data]);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    const students = studentsQuery.data ?? [];
    if (!term) {
      return students;
    }
    return students.filter((student) => {
      const haystack = [
        student.first_name,
        student.last_name,
        student.email,
        student.student_code ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [studentSearch, studentsQuery.data]);

  const filteredCopies = useMemo(() => {
    const term = copySearch.trim().toLowerCase();
    const copies = copiesQuery.data ?? [];
    if (!term) {
      return copies;
    }
    return copies.filter(
      (copy) =>
        copy.inventory_code.toLowerCase().includes(term) ||
        copy.book_title.toLowerCase().includes(term),
    );
  }, [copySearch, copiesQuery.data]);

  const issueMutation = useMutation({
    mutationFn: () =>
      issueBook({
        student_id: selectedStudent!.id,
        book_copy_id: selectedCopy!.id,
      }),
    onSuccess: (transaction) => {
      setSuccessMessage(
        `Issued ${transaction.book_copy.inventory_code} to ${transaction.student.first_name} ${transaction.student.last_name}. Due ${transaction.due_at}.`,
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
      setSuccessMessage(null);
      setShowIssueConfirm(false);
      setErrorMessage(getApiErrorMessage(error, "Unable to issue book."));
    },
  });

  const activeQueue = queueQuery.data ?? [];
  const nextReservation = activeQueue[0];

  const handleIssueClick = () => {
    if (!selectedStudent || !selectedCopy) {
      return;
    }
    if (activeQueue.length) {
      setShowIssueConfirm(true);
      return;
    }
    issueMutation.mutate();
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
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Filter by name, email, or student code"
              />
              <p className="text-xs text-muted-foreground">
                {studentsQuery.isLoading
                  ? "Loading students..."
                  : `Showing ${filteredStudents.length} of ${studentsQuery.data?.length ?? 0} students.`}
              </p>
              {studentsQuery.isError ? (
                <p className="text-sm text-destructive">Unable to load students.</p>
              ) : filteredStudents.length ? (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className={[
                        "block w-full px-3 py-2 text-left text-sm hover:bg-muted",
                        selectedStudent?.id === student.id ? "bg-muted font-medium" : "",
                      ].join(" ")}
                      onClick={() => setSelectedStudent(student)}
                    >
                      {formatStudentLabel(student)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No students match your filter.</p>
              )}
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
                onChange={(event) => setCopySearch(event.target.value)}
                placeholder="Filter by book title or inventory code"
              />
              <p className="text-xs text-muted-foreground">
                {copiesQuery.isLoading
                  ? "Loading available copies..."
                  : `Showing ${filteredCopies.length} of ${copiesQuery.data?.length ?? 0} available copies.`}
              </p>
              {copiesQuery.isError ? (
                <p className="text-sm text-destructive">Unable to load available copies.</p>
              ) : filteredCopies.length ? (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {filteredCopies.map((copy) => (
                    <button
                      key={copy.id}
                      type="button"
                      className={[
                        "block w-full px-3 py-2 text-left text-sm hover:bg-muted",
                        selectedCopy?.id === copy.id ? "bg-muted font-medium" : "",
                      ].join(" ")}
                      onClick={() => setSelectedCopy(copy)}
                    >
                      {copy.book_title} · {copy.inventory_code}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No available copies match your filter.</p>
              )}
              {selectedCopy ? (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedCopy.book_title} ({selectedCopy.inventory_code})
                </p>
              ) : null}
            </div>
          </div>

          {selectedCopy && queueQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Checking reservation queue...</p>
          ) : null}

          {selectedCopy && activeQueue.length ? (
            <ReservationQueueWarning queue={activeQueue} bookTitle={selectedCopy.book_title} />
          ) : null}

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

          <Button
            disabled={!selectedStudent || !selectedCopy || issueMutation.isPending}
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
            <Button disabled={issueMutation.isPending} onClick={() => issueMutation.mutate()}>
              {issueMutation.isPending ? "Issuing..." : "Issue Anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
