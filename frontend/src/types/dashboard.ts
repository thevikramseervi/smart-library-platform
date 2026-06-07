export interface StudentRecentLoan {
  book_title: string;
  issued_at: string;
  due_at: string;
  status: "ISSUED" | "RETURNED";
  is_overdue: boolean;
}

export interface StudentRecentReservation {
  book_title: string;
  queue_position: number | null;
  reservation_date: string;
}

export interface StudentDashboardResponse {
  active_loans: number;
  active_reservations: number;
  unpaid_fines: string;
  total_books_borrowed: number;
  recent_loans: StudentRecentLoan[];
  recent_reservations: StudentRecentReservation[];
}

export interface LibrarianRecentTransaction {
  book_title: string;
  student_name: string;
  student_code: string | null;
  action: "ISSUE" | "RETURN";
  occurred_at: string;
}

export interface LibrarianDashboardResponse {
  books_count: number;
  copies_count: number;
  active_loans: number;
  overdue_loans: number;
  reservations_count: number;
  unpaid_fines_count: number;
  recent_transactions: LibrarianRecentTransaction[];
}

export interface AdminUserActivity {
  activity_type: "CREATED" | "DEACTIVATED";
  user_name: string;
  email: string;
  role_name: string;
  occurred_at: string;
}

export interface AdminCirculationActivity {
  action: "ISSUE" | "RETURN";
  book_title: string;
  student_name: string;
  occurred_at: string;
}

export interface AdminDashboardResponse {
  users_count: number;
  students_count: number;
  librarians_count: number;
  departments_count: number;
  books_count: number;
  active_loans: number;
  recent_user_activity: AdminUserActivity[];
  recent_circulation_activity: AdminCirculationActivity[];
}
