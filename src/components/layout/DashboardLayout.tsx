
import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGym } from '@/contexts/GymContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const { gym } = useGym();

  const dynamicStyles = {
    primaryColor: gym?.brand_color || '#2563eb',
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Mobile Header with hamburger */}
        {isMobile && (
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </Button>
            <h1 
              className="font-semibold text-lg"
              style={{ color: dynamicStyles.primaryColor }}
            >
              {gym?.name || 'coreFit'}
            </h1>
          </div>
        )}
        
        <Header />
        <div className="p-4 md:p-6 flex-1">{children}</div>
      </main>
    </div>
  );
}
