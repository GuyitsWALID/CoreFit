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

      console.log('Current user:', user); // Debug log

      // First try to get staff record by user ID
      let { data: staffData, error } = await supabase
        .from('staff')
        .select(`
          id, 
          email, 
          roles!inner (
            name
          )
        `)
        .eq('id', user.id)
        .single();

      // If not found by ID, try by email
      if (error || !staffData) {
        console.log('Staff not found by ID, trying email:', user.email); // Debug log
        const { data: emailData, error: emailError } = await supabase
          .from('staff')
          .select(`
            id, 
            email, 
            roles!inner (
              name
            )
          `)
          .eq('email', user.email)
          .single();
        
        if (!emailError && emailData) {
          staffData = emailData;
        }
      }

      console.log('Staff data:', staffData); // Debug log

      if (staffData?.roles) {
        const roleName = staffData.roles.name?.toLowerCase();
        console.log('Role name:', roleName); // Debug log
        
        if (roleName === 'admin' || roleName === 'receptionist') {
          setRole(roleName as 'admin' | 'receptionist');
        } else {
          // Default to admin if role exists but doesn't match expected values
          setRole('admin');
        }
      } else {
        // If no staff record found, default to admin for logged-in users
        console.log('No staff record found, defaulting to admin'); // Debug log
        setRole('admin');
      }
    };

    fetchStaffRole();
  }, []);

  // Show navigation items based on role, with fallback to show admin items
  const filteredNavItems = navigation.filter(item => {
    if (!role) return false; // Don't show anything if role is not determined yet
    
    const allowedItems = navItemsByRole[role] || navItemsByRole.admin;
    return allowedItems.includes(item.name);
  });

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
          <h1 className="font-semibold text-lg"
          style={{ color: dynamicStyles.primaryColor }}>
        <span 
          >
          {gym?.name || 'coreFit'}
        </span>
        <p className="text-xs text-gray-500">Admin Panel</p>
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
      
      <div className="flex flex-col flex-1 p-4">
        {/* Navigation */}
        <nav className="space-y-1 flex-1">
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

        {/* Logout at bottom */}
        <NavLink
          to="/logout"
          className={`flex items-center gap-3 rounded-lg text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 mt-auto ${
        collapsed ? 'px-2 py-3 justify-center' : 'px-3 py-2'
          }`}
        >
          <LogOut className={collapsed ? "h-6 w-6" : "h-5 w-5"} />
          {!collapsed && "Logout"}
        </NavLink>
      </div>

        
     
    </aside>
  );
}
