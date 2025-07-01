import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
