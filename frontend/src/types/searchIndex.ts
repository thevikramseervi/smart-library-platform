export interface SearchIndexJob {
  id: string;
  mode: "RETRY" | "FULL";
  status: "RUNNING" | "COMPLETED" | "FAILED";
  started_at: string;
  finished_at: string | null;
  scanned: number;
  indexed: number;
  failed: number;
  error: string | null;
}

export interface SearchIndexStatus {
  total_books: number;
  indexed_books: number;
  pending_books: number;
  failed_books: number;
  enabled: boolean;
  model_name: string;
  job: SearchIndexJob | null;
}

export interface SearchIndexJobAccepted {
  job_id: string;
  status: "RUNNING";
  mode: "RETRY" | "FULL";
}
