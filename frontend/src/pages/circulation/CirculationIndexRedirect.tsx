import { Navigate } from "react-router-dom";

import { useIsStaff } from "@/lib/roles";

export function CirculationIndexRedirect() {
  const isStaff = useIsStaff();
  return <Navigate to={isStaff ? "/circulation/issue" : "/circulation/my-loans"} replace />;
}
