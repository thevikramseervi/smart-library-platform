export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TransactionUserSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_code: string | null;
}

export interface TransactionBookSummary {
  id: string;
  title: string;
}

export interface TransactionCopySummary {
  id: string;
  inventory_code: string;
  book_id: string;
  book: TransactionBookSummary;
}

export interface Transaction {
  id: string;
  book_copy_id: string;
  student_id: string;
  issued_by: string;
  issued_at: string;
  due_at: string;
  returned_at: string | null;
  status: "ISSUED" | "RETURNED";
  is_overdue: boolean;
  book_copy: TransactionCopySummary;
  student: TransactionUserSummary;
  issuer: TransactionUserSummary;
}

export interface TransactionIssueRequest {
  book_copy_id?: string;
  student_id?: string;
  inventory_code?: string;
  student_code?: string;
}

export interface TransactionReturnRequest {
  book_copy_id?: string;
  inventory_code?: string;
}

export interface ReservationBookSummary {
  id: string;
  title: string;
}

export interface ReservationStudentSummary {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string | null;
  email?: string;
}

export interface Reservation {
  id: string;
  student_id: string;
  book_id: string;
  reservation_date: string;
  expiry_date: string;
  status: "ACTIVE" | "FULFILLED" | "CANCELLED" | "EXPIRED";
  queue_position: number | null;
  book: ReservationBookSummary;
  student: ReservationStudentSummary;
}

export interface ReservationCreate {
  book_id: string;
}

export interface Fine {
  id: string;
  transaction_id: string;
  amount: string;
  reason: string;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface StudentSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_code: string | null;
}

export interface AvailableCopyResult {
  id: string;
  inventory_code: string;
  book_id: string;
  book_title: string;
  location: string | null;
}

export interface TransactionListParams {
  page?: number;
  page_size?: number;
  status?: "ISSUED" | "RETURNED";
  overdue?: boolean;
  student_id?: string;
  book_id?: string;
}

export interface ReservationListParams {
  page?: number;
  page_size?: number;
  book_id?: string;
  status?: Reservation["status"];
}

export interface FineListParams {
  page?: number;
  page_size?: number;
  paid?: boolean;
  student_id?: string;
}
