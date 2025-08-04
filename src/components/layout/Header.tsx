import React, { useEffect, useState } from 'react';
import { Bell, User } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/supabaseClient";

// Simple modal for logout confirmation
function ConfirmLogoutModal({ open, onConfirm, onCancel }: { open: boolean, onConfirm: () => void, onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg p-6 shadow-lg w-80">
        <h2 className="text-lg font-semibold mb-4">Confirm Logout</h2>
        <p className="mb-6">Are you sure you want to logout?</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Logout</Button>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const [userProfile, setUserProfile] = useState<{ full_name: string, role: string } | null>(null);
  const [notifications, setNotifications] = useState<{ id: string, title: string, body: string }[]>([]);
  const [logoutModal, setLogoutModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileAndNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch staff profile with role name
      let { data, error } = await supabase
        .from('staff')
        .select('full_name, role:roles(name)')
        .eq('id', user.id)
        .single();

      if (error && user.email) {
        const { data: emailData } = await supabase
          .from('staff')
          .select('full_name, role:roles(name)')
          .eq('email', user.email)
          .single();
        data = emailData;
      }

      let roleName: string | undefined;
      if (Array.isArray(data?.role)) {
        roleName = data.role[0]?.name;
      } else {
        roleName = data?.role?.name;
      }

      setUserProfile({
        full_name: data?.full_name || "User",
        role: roleName || "Staff"
      });

      // Fetch 3 most recent notifications for this user (customize as needed)
      const { data: notifData } = await supabase
        .from('notifications')
        .select('id, title, body')
        .order('created_at', { ascending: false })
        .limit(3);

      setNotifications(notifData || []);
    };

    fetchProfileAndNotifications();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLogoutModal(false);
    navigate("/login");
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Welcome back, {userProfile?.full_name || "User"} ({userProfile?.role || "Staff"})
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 && (
                <div className="px-4 py-2 text-gray-500 text-sm">No notifications</div>
              )}
              {notifications.map((notif) => (
                <DropdownMenuItem key={notif.id} className="py-2 cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{notif.title}</span>
                    <span className="text-sm text-gray-500">{notif.body}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="bg-fitness-primary text-white rounded-full p-1">
                  <User size={18} />
                </div>
                <span>{userProfile?.full_name || "User"}</span>
                <span className="text-xs text-gray-400 ml-1">({userProfile?.role || "Staff"})</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-500"
                onClick={() => setLogoutModal(true)}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <ConfirmLogoutModal
        open={logoutModal}
        onConfirm={handleLogout}
        onCancel={() => setLogoutModal(false)}
      />
    </>
  );
}
