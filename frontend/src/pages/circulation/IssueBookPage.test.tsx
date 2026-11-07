import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IssueBookPage } from "@/pages/circulation/IssueBookPage";
import {
  getReservationQueue,
  issueBook,
  listAvailableCopies,
  listTransactions,
  searchStudents,
} from "@/services/circulation";

vi.mock("@/services/circulation", () => ({
  getReservationQueue: vi.fn(),
  issueBook: vi.fn(),
  listAvailableCopies: vi.fn(),
  listTransactions: vi.fn(),
  searchStudents: vi.fn(),
}));

const copy = {
  id: "copy-1",
  book_id: "book-1",
  book_title: "The Test Book",
  inventory_code: "INV-001",
  location: "Shelf A",
};

const students = [
  { id: "student-1", first_name: "Sam", last_name: "Reader", email: "sam@campus.edu", student_code: "S-001" },
  { id: "student-2", first_name: "Jane", last_name: "Reader", email: "jane@campus.edu", student_code: "S-002" },
];

describe("IssueBookPage", () => {
  beforeEach(() => {
    vi.mocked(searchStudents).mockImplementation(async (q) =>
      q?.toLowerCase().includes("jane") ? [students[1]] : [students[0]],
    );
    vi.mocked(listAvailableCopies).mockResolvedValue([copy] as never);
    vi.mocked(listTransactions).mockResolvedValue({ items: [], total: 0 } as never);
    vi.mocked(getReservationQueue).mockResolvedValue([]);
    vi.mocked(issueBook).mockResolvedValue({
      book_copy: { inventory_code: copy.inventory_code },
      student: { first_name: students[0].first_name, last_name: students[0].last_name },
    } as never);
  });

  it("clears the selected copy when staff changes the student", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <IssueBookPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const studentInput = screen.getByLabelText("Student");
    fireEvent.change(studentInput, { target: { value: "Sam" } });
    fireEvent.click(await screen.findByRole("button", { name: /Sam Reader/ }));
    const copyButton = await screen.findByRole("button", { name: /INV-001/ });
    fireEvent.click(copyButton);
    expect(copyButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(studentInput, { target: { value: "Jane" } });
    fireEvent.click(await screen.findByRole("button", { name: /Jane Reader/ }));

    await waitFor(() => expect(listTransactions).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /INV-001/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Issue book" })).toBeDisabled();

    queryClient.clear();
  });

  it("issues the selected copy to the selected student after circulation checks pass", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <IssueBookPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "Sam" } });
    fireEvent.click(await screen.findByRole("button", { name: /Sam Reader/ }));
    fireEvent.click(await screen.findByRole("button", { name: /INV-001/ }));

    const issueButton = screen.getByRole("button", { name: "Issue book" });
    await waitFor(() => expect(issueButton).toBeEnabled());
    fireEvent.click(issueButton);

    await waitFor(() => {
      expect(issueBook).toHaveBeenCalledWith({
        student_id: "student-1",
        book_copy_id: "copy-1",
        bypass_reservation: undefined,
      });
    });

    queryClient.clear();
  });

  it("blocks issuing when the student's active-loan check fails", async () => {
    vi.mocked(listTransactions).mockRejectedValue(new Error("Loan service unavailable"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <IssueBookPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "Sam" } });
    fireEvent.click(await screen.findByRole("button", { name: /Sam Reader/ }));
    fireEvent.click(await screen.findByRole("button", { name: /INV-001/ }));

    expect(await screen.findByText(/Unable to check this student’s current loans/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Issue book" })).toBeDisabled();
    expect(issueBook).not.toHaveBeenCalled();

    queryClient.clear();
  });
});
