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
import OnboardingForm from '@/pages/admin/onboard/index.tsx';
import AdminGyms from '@/pages/admin/gyms';
import Analytics from '@/pages/admin/analytics';
import UserManagement from '@/pages/admin/users';
import AdminSettings from '@/pages/admin/settings'; 
import ImportPage from '@/pages/admin/import';
import Packages from './pages/Packages.tsx';

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
        <Routes>
          {/* Admin routes (no gym context needed) */}
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/admin" element={<div>Admin Overview</div>} />
          <Route path="/admin/gyms" element={<AdminGyms />} />
          <Route path="/admin/onboard" element={<OnboardingForm />} />
          <Route path="/admin/analytics" element={<Analytics />} />
          <Route path="/admin/users" element={<UserManagement/>} />
          <Route path="/admin/settings" element={<AdminSettings/>} />
          <Route path="/admin/import" element={<ImportPage/>} />
          
          {/* Gym-specific routes with dynamic identifier (ID or name) */}
          <Route path="/:gymIdentifier/*" element={
            <GymLayout>
              <Routes>
                <Route path="/admin/onboard" element={<OnboardingForm />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/memberships" element={<MembershipList />} />
                <Route path="/register" element={<RegisterClient />} />
                <Route path="/team" element={<Team />} />
                <Route path="/trainers" element={<TrainersList />} />
                <Route path="/packages" element={<Packages />} />
                <Route path="/check-ins" element={<CheckIns />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </GymLayout>
          } />
          
          {/* Default route redirects to onboarding */}
          <Route path="/" element={<Navigate to="/admin/onboard" replace />} />
          
          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        
        <Toaster />
      </div>
    </Router>
  );
}

export default App;
