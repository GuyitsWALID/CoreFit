import React, { useEffect, useState, useMemo } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useGym } from "@/contexts/GymContext";
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
  Settings,
  ChartArea,
  LayoutDashboard,
  Calendar,
  BarChart3,
  UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Memberships', href: '/memberships', icon: Users },
  { name: 'Register Client', href: '/register', icon: User },
  { name: 'Check-ins', href: '/check-ins', icon: Calendar },
  { name: 'Team', href: '/team', icon: UserCog },
  { name: 'Trainers', href: '/trainers', icon: Dumbbell },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const navItemsByRole: Record<'admin' | 'receptionist', string[]> = {
  admin: navigation.map(item => item.name),
  receptionist: [
    "Dashboard",
    "Register Client",
    "Team",
    "Trainer",
    "Check-ins",
  ],
};

export function Sidebar() {
  const { gym } = useGym();
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
      const roleName = data?.role?.[0]?.name;
      if (roleName === 'admin' || roleName === 'receptionist' ) {
        setRole(roleName);
      } else {
        setRole(null);
      }
    };

    fetchStaffRole();
  }, []);

  const filteredNavItems = navigation.filter(item =>
    (role && navItemsByRole[role]) ? navItemsByRole[role].includes(item.name) : false
  );

  const gymRoutePrefix = useMemo(() => {
    if (!gym || gym.id === 'default') return '';
    return `/${gym.id}`;
  }, [gym]);

  const getNavPath = (href: string) => {
    if (gym && gym.id !== 'default') {
      return `/${gym.id}${href}`;
    }
    return href;
  };

  const dynamicStyles = {
    primaryColor: gym?.brand_color || '#2563eb',
    secondaryColor: gym?.brand_color || '#1e40af',
    accentColor: gym?.brand_color || '#f59e0b',
  };

  const isActiveRoute = (href: string) => {
    const fullPath = getNavPath(href);
    return location.pathname === fullPath || 
           location.pathname.startsWith(fullPath + '/') ||
           (href === '/dashboard' && location.pathname === '/');
  };

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
      
      <div className="p-6">
        {/* Gym logo and name */}
        <div className="flex items-center gap-3 mb-8">
          {gym?.logo && (
            <img 
              src={gym.logo} 
              alt={`${gym.name} logo`}
              className="h-8 w-8 object-contain rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div>
            <h2 
              className="font-bold text-lg"
              style={{ color: dynamicStyles.primaryColor }}
            >
              {gym?.name || 'ATL Fitness Hub'}
            </h2>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {filteredNavItems.map((item) => {
            const href = getNavPath(item.href);
            const active = isActiveRoute(item.href);
            
            return (
              <NavLink
                key={item.name}
                to={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                style={active ? { 
                  backgroundColor: dynamicStyles.primaryColor,
                  color: 'white'
                } : {}}
              >
                <item.icon className="h-5 w-5" />
                {!collapsed && item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="mt-8 pt-8 border-t">
          <NavLink
            to="/logout"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && "Logout"}
          </NavLink>
        </div>

        {/* Gym info footer */}
        <div className="mt-8 pt-4 border-t">
          <div className="text-xs text-gray-400">
            <div>Workspace: /{gym?.id || 'default'}</div>
            <div className="mt-1">Status: {gym?.status || 'Active'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
