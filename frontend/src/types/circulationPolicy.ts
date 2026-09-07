export interface PolicyUserSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface CirculationPolicyResponse {
  id: string;
  name: string;
  daily_overdue_fine_rate: string | number;
  max_fine_amount: string | number;
  loan_period_days: number;
  max_active_loans: number;
  reservation_expiry_days: number;
  is_active: boolean;
  updated_by?: string | null;
  updated_by_user?: PolicyUserSummary | null;
  created_at: string;
  updated_at: string;
}

export interface CirculationPolicyUpdate {
  daily_overdue_fine_rate: number | string;
  max_fine_amount: number | string;
  loan_period_days: number;
  max_active_loans: number;
  reservation_expiry_days: number;
}
