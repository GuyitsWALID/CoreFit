import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  LogOut,
  Home,
  UserPlus2Icon as User,
  Users,
  Dumbbell,
  ClipboardList,
  Package,
  Bell,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/supabaseClient";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: string | number }>;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    label: "Register Client",
    href: "/register-client",
    icon: User,
  },
  {
    label: "Team",
    href: "/team",
    icon: Users,
  },
  {
    label: "Trainer",
    href: "/trainers",
    icon: Dumbbell,
  },
  {
    label: "Check-ins",
    href: "/check-ins",
    icon: ClipboardList,
  },
  {
    label: "Packages",
    href: "/packages",
    icon: Package,
  },
  {
    label: "Members List",
    href: "/expiring-memberships",
    icon: Users,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: ClipboardList,
  },
  
  {
    label: "Notifications",
    href: "/notification",
    icon: Bell,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

const navItemsByRole: Record<'admin' | 'receptionist', string[]> = {
  admin: navItems.map(item => item.label),
  receptionist: [
    "Dashboard",
    "Register Client",
    "Team",
    "Trainer",
    "Check-ins",
  ],
};

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);
  const [role, setRole] = useState<'admin' | 'receptionist' | null>(null);

  useEffect(() => {
    const fetchStaffRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setRole(null);

      // Join staff with roles table to get the role name
      let { data, error } = await supabase
        .from('staff')
        .select('id, email, role:roles(name)')
        .eq('id', user.id)
        .single();

      if (error && user.email) {
        // fallback to email if id not found
        const { data: emailData } = await supabase
          .from('staff')
          .select('id, email, role:roles(name)')
          .eq('email', user.email)
          .single();
        data = emailData;
      }

      // data.role will be { name: 'admin' } or { name: 'receptionist' }
      const roleName = data?.role?.name;
      if (roleName === 'admin' || roleName === 'receptionist') {
        setRole(roleName);
      } else {
        setRole(null);
      }
    };

    fetchStaffRole();
  }, []);

  const filteredNavItems = navItems.filter(item =>
    (role && navItemsByRole[role]) ? navItemsByRole[role].includes(item.label) : false
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
