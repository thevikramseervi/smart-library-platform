import { QueryClient } from "@tanstack/react-query";

export const REFERENCE_DATA_STALE_TIME = 5 * 60 * 1000;
export const DASHBOARD_STALE_TIME = 30 * 1000;

export const queryClient = new QueryClient();
