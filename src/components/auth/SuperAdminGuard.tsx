import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

type AccessState = 'checking' | 'allowed' | 'denied';

export function SuperAdminGuard({ children }: { children?: React.ReactNode }) {
  const [access, setAccess] = useState<AccessState>('checking');
  const location = useLocation();

  useEffect(() => {
    let active = true;
    let timeoutId: number | undefined;

    const verify = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      const user = session?.user;
      if (sessionError || !user) {
        if (active) {
          if (timeoutId) window.clearTimeout(timeoutId);
          setAccess('denied');
        }
        return;
      }

      const role = String(user.app_metadata?.role ?? user.app_metadata?.account_type ?? '').trim().toLowerCase();
      if (active) {
        if (timeoutId) window.clearTimeout(timeoutId);
        setAccess(role === 'super_admin' ? 'allowed' : 'denied');
      }
    };

    timeoutId = window.setTimeout(() => {
      if (active) setAccess('denied');
    }, 5000);
    verify();
    return () => {
      active = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  if (access === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-sm text-gray-500">Verifying super-admin access…</p>
        </div>
      </div>
    );
  }

  if (access === 'denied') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children ?? <Outlet />}</>;
}
