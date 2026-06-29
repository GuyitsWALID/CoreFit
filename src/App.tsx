// deno-lint-ignore-file
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { GymProvider } from '@/contexts/GymContext';

// Import your existing components
import Dashboard from '@/pages/Dashboard';
import MembershipList from '@/pages/MembershipList';
import RegisterClient from '@/pages/RegisterClient';
import Team from '@/pages/Team';
import TrainersList from '@/pages/TrainersList';
import Settings from '@/pages/Settings';
import Reports from '@/pages/Reports';
import CheckIns from '@/pages/CheckIns';
import AdminLogin from '@/pages/AdminLogin';
import Logout from '@/pages/Logout';
import NotFound from '@/pages/NotFound';
import ResetPassword from '@/pages/ResetPassword';
import ResetPasswordComplete from '@/pages/ResetPasswordComplete';
import OnboardingForm from '@/pages/admin/onboard/index.tsx';
import AdminGyms from '@/pages/admin/gyms';
import Analytics from '@/pages/admin/analytics';
import UserManagement from '@/pages/admin/users';
import AdminSettings from '@/pages/admin/settings'; 
import AdminOfflineRenewals from '@/pages/admin/offline-renewals';
import { MigrationDashboard } from '@/components/MigrationPage';
import Packages from './pages/Packages.tsx';
import { SuperAdminGuard } from '@/components/auth/SuperAdminGuard';
import { AdminHotkeyGate, hasSuperAdminEntry } from '@/components/auth/AdminHotkeyGate';
import { GymRoleGuard } from '@/components/auth/GymRoleGuard';

// Layout component that wraps gym-specific pages
const GymLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <GymProvider>
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </GymProvider>
  );
};

function App() {
  return (
    <Router>
      <div className="App">
        <AdminHotkeyGate />
        <Routes>
          {/* Admin routes (no gym context needed) */}
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/admin/login" element={hasSuperAdminEntry() ? <AdminLogin /> : <Navigate to="/login" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/reset-password/complete" element={<ResetPasswordComplete />} />
          <Route path="/admin" element={<SuperAdminGuard />}>
            <Route index element={<Navigate to="/admin/gyms" replace />} />
            <Route path="gyms" element={<AdminGyms />} />
            <Route path="onboard" element={<OnboardingForm />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="offline-renewals" element={<AdminOfflineRenewals />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="import" element={<MigrationDashboard />} />
          </Route>
          
          {/* Gym-specific routes with dynamic identifier (ID or name) */}
          <Route path="/:gymIdentifier/*" element={
            <GymLayout>
              <Routes>
                <Route path="/admin/onboard" element={<OnboardingForm />} />
                <Route path="/dashboard" element={<GymRoleGuard allowedRoles={['admin', 'manager', 'receptionist']}><Dashboard /></GymRoleGuard>} />
                <Route path="/memberships" element={<GymRoleGuard allowedRoles={['admin', 'manager', 'receptionist']}><MembershipList /></GymRoleGuard>} />
                <Route path="/register" element={<GymRoleGuard allowedRoles={['admin', 'manager', 'receptionist']}><RegisterClient /></GymRoleGuard>} />
                <Route path="/team" element={<GymRoleGuard allowedRoles={['admin', 'manager']}><Team /></GymRoleGuard>} />
                <Route path="/trainers" element={<GymRoleGuard allowedRoles={['admin', 'manager']}><TrainersList /></GymRoleGuard>} />
                <Route path="/packages" element={<GymRoleGuard allowedRoles={['admin', 'manager', 'receptionist']}><Packages /></GymRoleGuard>} />
                <Route path="/check-ins" element={<GymRoleGuard allowedRoles={['admin', 'manager', 'receptionist']}><CheckIns /></GymRoleGuard>} />
                <Route path="/reports" element={<GymRoleGuard allowedRoles={['admin']}><Reports /></GymRoleGuard>} />
                <Route path="/settings" element={<GymRoleGuard allowedRoles={['admin']}><Settings /></GymRoleGuard>} />
                <Route path="/logout" element={<Logout />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </GymLayout>
          } />
          
          {/* Default route redirects to onboarding */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        
        <Toaster />
      </div>
    </Router>
  );
}

export default App;
