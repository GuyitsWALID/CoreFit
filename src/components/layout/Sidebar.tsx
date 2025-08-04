import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Define NavItem type if not already defined
type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
};

// Add a role prop or get it from context/auth
type SidebarProps = {
  role: 'admin' | 'receptionist';
};

const navItems: NavItem[] = [
  // ...same as before
];

// Define which tabs are visible for each role
const navItemsByRole: Record<SidebarProps['role'], string[]> = {
  admin: navItems.map(item => item.label), // all tabs
  receptionist: [
    'Dashboard',
    'Register Client',
    'Check-ins',
    'Packages',
    'Members List',
    'Notifications',
    'Settings',
  ],
};

export function Sidebar({ role }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);

  // Filter navItems based on role
  const filteredNavItems = navItems.filter(item =>
    navItemsByRole[role].includes(item.label)
  );

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
          {filteredNavItems.map((item) => (
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
