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

export interface CirculationReportResponse {
  start_date: string;
  end_date: string;
  loans_issued: number;
  returns_processed: number;
  overdue_at_period_end: number;
  fines_collected: string;
  popular_books: Array<{ book_title: string; loans_issued: number }>;
  trend_interval: "day" | "week" | "month";
  trend: Array<{
    period_start: string;
    loans_issued: number;
    returns_processed: number;
    fines_collected: string;
  }>;
  reservations_placed: number;
  reservations_fulfilled: number;
  reservations_expired: number;
  reservations_cancelled: number;
  average_reservation_wait_days: string | null;
  reservation_trend: Array<{
    period_start: string;
    reservations_placed: number;
    reservations_fulfilled: number;
  }>;
  popular_categories: Array<{ category_name: string; loans_issued: number }>;
  on_time_returns: number;
  late_returns: number;
  on_time_return_rate_percent: string | null;
  average_days_late: string | null;
  overdue_1_7_days_at_period_end: number;
  overdue_8_30_days_at_period_end: number;
  overdue_31_plus_days_at_period_end: number;
  current_unpaid_fine_balance: string;
  current_unpaid_fine_count: number;
  department_participation: Array<{
    department_name: string;
    active_students: number;
    borrowing_students: number;
    participation_rate_percent: string;
    loans_issued: number;
  }>;
  inventory_status: {
    total_copies: number;
    available_copies: number;
    borrowed_copies: number;
    reserved_copies: number;
    out_of_service_copies: number;
  };
  reservation_pressure_title_count: number;
  reservation_pressure_books: Array<{
    book_title: string;
    waiting_reservations: number;
    available_copies: number;
    reserved_copies: number;
    loans_issued: number;
  }>;
  no_loan_title_count: number;
  no_loan_books: Array<{ book_title: string; available_copies: number }>;
}
