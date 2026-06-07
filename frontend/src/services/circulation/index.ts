import { api } from "@/services/api";
import type {
  AvailableCopyResult,
  Fine,
  FineListParams,
  PaginatedResponse,
  Reservation,
  ReservationCreate,
  ReservationListParams,
  StudentSearchResult,
  Transaction,
  TransactionIssueRequest,
  TransactionListParams,
  TransactionReturnRequest,
} from "@/types/circulation";

export async function issueBook(payload: TransactionIssueRequest): Promise<Transaction> {
  const response = await api.post<Transaction>("/transactions/issue", payload);
  return response.data;
}

export async function returnBook(payload: TransactionReturnRequest): Promise<Transaction> {
  const response = await api.post<Transaction>("/transactions/return", payload);
  return response.data;
}

export async function listTransactions(
  params?: TransactionListParams,
): Promise<PaginatedResponse<Transaction>> {
  const response = await api.get<PaginatedResponse<Transaction>>("/transactions", { params });
  return response.data;
}

export async function listMyActiveTransactions(): Promise<Transaction[]> {
  const response = await api.get<Transaction[]>("/transactions/me/active");
  return response.data;
}

export async function listMyTransactions(
  params?: TransactionListParams,
): Promise<PaginatedResponse<Transaction>> {
  const response = await api.get<PaginatedResponse<Transaction>>("/transactions/me", { params });
  return response.data;
}

export async function searchStudents(q?: string): Promise<StudentSearchResult[]> {
  const response = await api.get<StudentSearchResult[]>("/circulation/students/search", {
    params: q ? { q } : undefined,
  });
  return response.data;
}

export async function listAvailableCopies(params?: {
  book_id?: string;
  q?: string;
}): Promise<AvailableCopyResult[]> {
  const response = await api.get<AvailableCopyResult[]>("/circulation/copies/available", {
    params,
  });
  return response.data;
}

export async function createReservation(payload: ReservationCreate): Promise<Reservation> {
  const response = await api.post<Reservation>("/reservations", payload);
  return response.data;
}

export async function cancelReservation(id: string): Promise<void> {
  await api.delete(`/reservations/${id}`);
}

export async function listMyReservations(): Promise<Reservation[]> {
  const response = await api.get<Reservation[]>("/reservations/me");
  return response.data;
}

export async function listReservations(
  params?: ReservationListParams,
): Promise<PaginatedResponse<Reservation>> {
  const response = await api.get<PaginatedResponse<Reservation>>("/reservations", { params });
  return response.data;
}

export async function getReservationQueue(bookId: string): Promise<Reservation[]> {
  const response = await api.get<Reservation[]>(`/reservations/queue/${bookId}`);
  return response.data;
}

export async function listMyFines(): Promise<Fine[]> {
  const response = await api.get<Fine[]>("/fines/me");
  return response.data;
}

export async function listFines(params?: FineListParams): Promise<PaginatedResponse<Fine>> {
  const response = await api.get<PaginatedResponse<Fine>>("/fines", { params });
  return response.data;
}

export async function markFinePaid(id: string): Promise<Fine> {
  const response = await api.post<Fine>(`/fines/${id}/pay`);
  return response.data;
}
