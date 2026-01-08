import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Plus, Settings, BarChart3, Users, Home, Menu, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface SuperAdSidebarProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const SuperAdSidebar: React.FC<SuperAdSidebarProps> = ({ className, isOpen = true, onToggle }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = React.useState(false);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile && onToggle && isOpen) {
      onToggle();
    }
  }, [location.pathname]);

  const navigationItems = [
    
    {
      name: 'Gym Management',
      href: '/admin/gyms',
      icon: Building2,
      description: 'View and manage all gyms'
    },
    {
      name: 'Onboard New Gym',
      href: '/admin/onboard',
      icon: Plus,
      description: 'Add a new gym to the system'
    },
    {
      name: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      description: 'System-wide analytics'
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: Users,
      description: 'Manage system users'
    },
    {
      name: 'Import Data',
      href: '/admin/import',
      icon: Upload,
      description: 'Import gym client data'
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      description: 'System configuration'
    },
  ];

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onToggle}
        />
      )}
      
      <aside className={cn(
        "bg-white border-r border-gray-200 min-h-screen flex flex-col transition-all duration-300",
        // Desktop styles
        !isMobile && (collapsed ? "w-16" : "w-64"),
        // Mobile styles
        isMobile && "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out",
        isMobile && (isOpen ? "translate-x-0" : "-translate-x-full"),
        className
      )}>
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {(!collapsed || isMobile) ? (
            <>
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-lg text-gray-900">Super Admin</h1>
                <p className="text-xs text-gray-500">Gym Management Saas</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  if (isMobile && onToggle) {
                    onToggle();
                  } else {
                    setCollapsed(true);
                  }
                }}
                className="flex-shrink-0"
                aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
              >
                {isMobile ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </>
          ) : (
            // Collapsed state - logo icon is the toggle button
            <button
              onClick={() => setCollapsed(false)}
              className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center mx-auto hover:bg-blue-700 transition-colors cursor-pointer"
              aria-label="Expand sidebar"
            >
              <Building2 className="h-6 w-6 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group',
                  active
                    ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                  collapsed && !isMobile && 'justify-center px-2'
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-colors flex-shrink-0",
                  active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                )} />
                {(!collapsed || isMobile) && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.name}</div>
                    <div className={cn(
                      "text-xs transition-colors truncate",
                      active ? "text-blue-600" : "text-gray-400"
                    )}>
                      {item.description}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        {(!collapsed || isMobile) ? (
          <div className="text-xs text-gray-500 text-center">
            <div>CoreFit Super Admin</div>
            <div className="mt-1">v1.0.0</div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 text-center">
            <div>v1.0</div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
};

export default SuperAdSidebar;
