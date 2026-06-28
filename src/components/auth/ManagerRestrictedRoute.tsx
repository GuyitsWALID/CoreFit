import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useGym } from "@/contexts/GymContext";
import { getCurrentStaffRole, StaffRole } from "@/lib/staffRole";

interface ManagerRestrictedRouteProps {
  children: React.ReactNode;
}

export function ManagerRestrictedRoute({ children }: ManagerRestrictedRouteProps) {
  const { gym } = useGym();
  const location = useLocation();
  const [role, setRole] = useState<StaffRole | null>(null);

  useEffect(() => {
    if (!gym || gym.id === "default") return;
    getCurrentStaffRole(gym.id).then(setRole);
  }, [gym?.id]);

  const dashboardPath = useMemo(() => {
    if (!gym || gym.id === "default") return "/login";
    return `/${(gym as any).slug || gym.id}/dashboard`;
  }, [gym]);

  if (!role) return null;

  if (role === "manager") {
    return <Navigate to={dashboardPath} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
