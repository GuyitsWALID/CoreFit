import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useGym } from "@/contexts/GymContext";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentStaffRole, StaffRole } from "@/lib/staffRole";

interface GymRoleGuardProps {
  allowedRoles: StaffRole[];
  children: React.ReactNode;
}

export function GymRoleGuard({ allowedRoles, children }: GymRoleGuardProps) {
  const { gym } = useGym();
  const location = useLocation();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      if (!gym || gym.id === "default") return;

      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setHasUser(false);
        setRole(null);
        return;
      }

      setHasUser(true);
      const currentRole = await getCurrentStaffRole(gym.id);
      if (!cancelled) setRole(currentRole);
    };

    loadRole();

    return () => {
      cancelled = true;
    };
  }, [gym?.id]);

  const fallbackPath = useMemo(() => {
    if (!gym || gym.id === "default") return "/login";
    const prefix = `/${(gym as any).slug || gym.id}`;
    return role === "receptionist" ? `${prefix}/memberships` : `${prefix}/dashboard`;
  }, [gym, role]);

  if (hasUser === false) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!role) return null;

  if (!allowedRoles.includes(role)) {
    return <Navigate to={fallbackPath} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
