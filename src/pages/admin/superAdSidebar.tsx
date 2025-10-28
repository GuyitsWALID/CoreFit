import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Plus, Settings, BarChart3, Users, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuperAdSidebarProps {
  className?: string;
}

export const SuperAdSidebar: React.FC<SuperAdSidebarProps> = ({ className }) => {
  const location = useLocation();

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
    <aside className={cn(
      "bg-white border-r border-gray-200 min-h-screen w-64 flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900">Super Admin</h1>
            <p className="text-xs text-gray-500">Gym Management Saas</p>
          </div>
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
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-colors",
                  active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                )} />
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className={cn(
                    "text-xs transition-colors",
                    active ? "text-blue-600" : "text-gray-400"
                  )}>
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 text-center">
          <div>CoreFit Super Admin</div>
          <div className="mt-1">v1.0.0</div>
        </div>
      </div>
    </aside>
  );
};

export default SuperAdSidebar;
