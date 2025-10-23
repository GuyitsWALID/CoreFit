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
import OnboardingForm from './pages/onboard/index.tsx';

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
          <Route path="/admin/login" element={<AdminLogin />} />
          
          {/* Gym-specific routes with dynamic identifier (ID or name) */}
          <Route path="/:gymIdentifier/*" element={
            <GymLayout>
              <Routes>
                <Route path="/" element={<OnboardingForm />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/memberships" element={<MembershipList />} />
                <Route path="/register" element={<RegisterClient />} />
                <Route path="/team" element={<Team />} />
                <Route path="/trainers" element={<TrainersList />} />
                <Route path="/check-ins" element={<CheckIns />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </GymLayout>
          } />
          
          {/* Default routes (fallback to default gym) */}
          <Route path="/" element={
            <GymLayout>
              <Dashboard />
            </GymLayout>
          } />
          
          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        
        <Toaster />
      </div>
    </Router>
  );
}

export default App;

