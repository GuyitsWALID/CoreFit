import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { DynamicHeader } from '@/components/layout/DynamicHeader';
import { Sidebar } from '@/components/layout/Sidebar';

const TABS = ["Personal Info", "Notifications", "Account", "Password"];

export default function Settings() {
  const [tab, setTab] = useState("Personal Info");
  const [userInfo, setUserInfo] = useState<{ full_name: string; email: string; role: string } | null>(null);
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let { data, error } = await supabase
        .from('staff')
        .select('full_name, email, role:roles(name)')
        .eq('id', user.id)
        .single();
      if (error && user.email) {
        const { data: emailData } = await supabase
          .from('staff')
          .select('full_name, email, role:roles(name)')
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
      setUserInfo({
        full_name: data?.full_name || "",
        email: data?.email || "",
        role: roleName || "",
      });
    };
    fetchUserInfo();
  }, []);

  // Password strength checker
  function getPasswordStrength(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  useEffect(() => {
    setPasswordStrength(getPasswordStrength(newPassword));
  }, [newPassword]);

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (passwordStrength < 4) {
      setPasswordError("Password is not strong enough.");
      return;
    }
    // Re-authenticate user (Supabase does not support password check directly, so you must sign in again)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || !user.email) {
      setPasswordError("User not found.");
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      setPasswordError("Current password is incorrect.");
      return;
    }
    // Update password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setPasswordError("Failed to update password.");
    } else {
      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DynamicHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="max-w-2xl mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <div className="flex border-b mb-8">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2 -mb-px border-b-2 transition-all font-medium ${
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-blue-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow p-8">
        {tab === "Personal Info" && (
          <div>
            <h2 className="font-semibold text-lg mb-2">Personal Information</h2>
            <p className="text-gray-500 mb-4">View your account details and role.</p>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <Input value={userInfo?.full_name || ""} disabled />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input value={userInfo?.email || ""} disabled />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <Input value={userInfo?.role || ""} disabled />
              </div>
            </div>
          </div>
        )}
        {tab === "Notifications" && (
          <div>
            <h2 className="font-semibold text-lg mb-2">Notification Preferences</h2>
            <p className="text-gray-500 mb-6">Manage how and when you receive notifications</p>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Email Notifications</div>
                    <div className="text-gray-500 text-sm">Receive notifications via email</div>
                  </div>
                  <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Push Notifications</div>
                    <div className="text-gray-500 text-sm">Receive notifications on your device</div>
                  </div>
                  <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button>Save Preferences</Button>
              </div>
            </div>
          </div>
        )}
        {tab === "Account" && (
          <div>
            <h2 className="font-semibold text-lg mb-2">Account Management</h2>
            <p className="text-gray-500 mb-6">Manage your account access and data</p>
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="font-semibold mb-1">Data Export</div>
                <div className="text-sm text-yellow-800 mb-2">
                  You can request a copy of all your data. This includes your profile information, listings, and messages.
                </div>
                <Button
                  variant="outline"
                  className="border-yellow-400 text-yellow-800"
                  disabled={exporting}
                  onClick={() => setExporting(true)}
                >
                  {exporting ? "Exporting..." : "Request Data Export"}
                </Button>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="font-semibold mb-1 text-red-700">Delete Account</div>
                <div className="text-sm text-red-700 mb-2">
                  Permanently delete your account and all your data. This action cannot be undone.
                </div>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => setDeleting(true)}
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </Button>
              </div>
              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/logout")}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}
        {tab === "Password" && (
          <form onSubmit={handlePasswordReset} className="max-w-md mx-auto space-y-6">
            <h2 className="font-semibold text-lg mb-2">Reset Password</h2>
            <p className="text-gray-500 mb-4">Change your account password. Make sure your new password is strong.</p>
            <div>
              <label className="block text-sm font-medium mb-1">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <PasswordStrengthBar strength={passwordStrength} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {passwordError && <div className="text-red-600 text-sm">{passwordError}</div>}
            {passwordSuccess && <div className="text-green-600 text-sm">{passwordSuccess}</div>}
            <div className="flex justify-end">
              <Button type="submit">Update Password</Button>
            </div>
          </form>
        )}
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Password strength bar component
function PasswordStrengthBar({ strength }: { strength: number }) {
  const levels = [
    { color: "bg-red-400", label: "Very Weak" },
    { color: "bg-orange-400", label: "Weak" },
    { color: "bg-yellow-400", label: "Fair" },
    { color: "bg-blue-400", label: "Good" },
    { color: "bg-green-500", label: "Strong" },
  ];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-2 rounded transition-all duration-200 flex-1 ${i < strength ? levels[i].color : "bg-gray-200"}`}
          />
        ))}
      </div>
      <div className="text-xs mt-1 text-gray-500">
        {levels[Math.max(0, strength - 1)].label}
      </div>
    </div>
  );
}