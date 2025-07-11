
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Home, 
  Users, 
  Calendar, 
  Package, 
  Clock, 
  UserCog, 
  FileText,
  Settings,
  LogOut,
  Menu,
  Bell,
  BellDot,
  Dumbbell
} from 'lucide-react';
import { Button } from "@/components/ui/button";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    label: 'Register Client',
    href: '/register-client',
    icon: Users,
  },
  {
    label: 'Check-ins',
    href: '/check-ins',
    icon: Calendar,
  },
  {
    label: 'Packages',
    href: '/packages',
    icon: Package,
  },
  {
    label: 'Members List',
    href: '/expiring-memberships',
    icon: Clock,
  },
  {
    label: 'Team',
    href: '/team',
    icon: UserCog,
  },
  {
    label: 'Trainers',
    href: '/trainers',
    icon: Dumbbell,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: FileText,
  },
   {
    label: 'Notifications',
    href: '/notification',
    icon: Bell,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);
  
  return (
    <aside className={cn(
      "bg-white border-r border-gray-200 min-h-screen transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        {!collapsed && (
          <h1 className="font-semibold text-lg">
            <span className="text-fitness-primary">ATL</span> Fitness
          </h1>
        )}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={20} />
        </Button>
      </div>
      
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  location.pathname === item.href 
                    ? "bg-fitness-primary text-white" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-100">
        <Link
          to="/logout"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-gray-700 hover:bg-gray-100"
          )}
        >
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
        </Link>
      </div>
    </aside>
  );
}
