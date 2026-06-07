import { Navigate } from "react-router-dom";

import { useIsStaff } from "@/components/auth/StaffRoute";

export function CirculationIndexRedirect() {
  const isStaff = useIsStaff();
  return <Navigate to={isStaff ? "/circulation/issue" : "/circulation/my-loans"} replace />;
}
