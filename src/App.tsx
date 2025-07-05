import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import RegisterClient from "./pages/RegisterClient";
import CheckIns from "./pages/CheckIns";
import Packages from "./pages/Packages";
import ExpiringMemberships from "./pages/MembershipList";
import Team from "./pages/Team";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Logout from "./pages/Logout";
import NotFound from "./pages/NotFound";
import AdminLogin from './pages/AdminLogin';
import Notifications from "./pages/Notifications";
import { useEffect } from "react";
import { supabase } from "./supabaseClient";
import { Analytics } from "@vercel/analytics/next"
import React from "react";


const queryClient = new QueryClient();

const RequireAdminLogin = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  useEffect(() => {
    // Check Supabase auth session
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (data?.session) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        if (location.pathname !== "/admin/login") {
          navigate("/admin/login");
        }
      }
      setIsLoading(false);
    };
    checkSession();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        if (location.pathname !== "/admin/login") {
          navigate("/admin/login");
        }
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [location.pathname, navigate]);

  if (isLoading) {
    return null;
  }
  if (!isLoggedIn && location.pathname !== "/admin/login") {
    return null;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/*"
            element={
              <RequireAdminLogin>
                <Routes>
                  <Route path="/" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
                  <Route path="/register-client" element={<DashboardLayout><RegisterClient /></DashboardLayout>} />
                  <Route path="/check-ins" element={<DashboardLayout><CheckIns /></DashboardLayout>} />
                  <Route path="/packages" element={<DashboardLayout><Packages /></DashboardLayout>} />
                  <Route path="/expiring-memberships" element={<DashboardLayout><ExpiringMemberships /></DashboardLayout>} />
                  <Route path="/team" element={<DashboardLayout><Team /></DashboardLayout>} />
                  <Route path="/reports" element={<DashboardLayout><Reports /></DashboardLayout>} />
                  <Route path="/notification" element={<DashboardLayout><Notifications /></DashboardLayout>} />
                  <Route path="/settings" element={<DashboardLayout><Settings /></DashboardLayout>} />
                  <Route path="/logout" element={<Logout />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </RequireAdminLogin>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
