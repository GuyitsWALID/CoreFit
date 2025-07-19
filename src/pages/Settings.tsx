import React, { useState } from 'react';
import { User, Lock, Bell, Users } from "lucide-react";

export default function Settings() {
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('admin@example.com');
  const [gymName, setGymName] = useState('ATL Fitness Hub');
  const [message, setMessage] = useState('');

  // Notification preferences state
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);

  // Member roles state
  const [roles, setRoles] = useState([
    { name: "Admin", enabled: true },
    { name: "Trainer", enabled: true },
    { name: "Receptionist", enabled: false },
    { name: "Member", enabled: true }
  ]);

  const handleRoleToggle = (idx: number) => {
    setRoles(roles =>
      roles.map((role, i) =>
        i === idx ? { ...role, enabled: !role.enabled } : role
      )
    );
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match.');
      return;
    }
    // Add password change logic here
    setMessage('Password changed successfully.');
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Add profile save logic here
    setMessage('Profile updated successfully.');
  };

  return (
    <div className="animate-fade-in min-h-screen bg-white py-10 px-2 md:px-0">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-4xl font-extrabold tracking-tight mb-10 text-center" style={{ color: "#6c9d9a" }}>
          Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Profile Settings Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col gap-6 border" style={{ borderColor: "#6c9d9a" }}>
            <div className="flex items-center gap-3 mb-2">
              <User className="h-6 w-6" style={{ color: "#6c9d9a" }} />
              <h3 className="text-xl font-semibold" style={{ color: "#6c9d9a" }}>Profile Settings</h3>
            </div>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block mb-1 font-medium" style={{ color: "#6c9d9a" }}>Gym Name</label>
                <input
                  type="text"
                  value={gymName}
                  onChange={e => setGymName(e.target.value)}
                  className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2 bg-[#f3f7f7]"
                  style={{ borderColor: "#6c9d9a", color: "#222" }}
                  // focus:ring color
                  onFocus={e => e.target.style.boxShadow = `0 0 0 2px #6c9d9a`}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
              <div>
                <label className="block mb-1 font-medium" style={{ color: "#6c9d9a" }}>Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2 bg-[#f3f7f7]"
                  style={{ borderColor: "#6c9d9a", color: "#222" }}
                  onFocus={e => e.target.style.boxShadow = `0 0 0 2px #6c9d9a`}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
              <button type="submit" className="px-6 py-2 rounded-lg font-semibold transition" style={{ background: "#6c9d9a", color: "#fff" }}>
                Save Changes
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col gap-6 border" style={{ borderColor: "#6c9d9a" }}>
            <div className="flex items-center gap-3 mb-2">
              <Lock className="h-6 w-6" style={{ color: "#6c9d9a" }} />
              <h3 className="text-xl font-semibold" style={{ color: "#6c9d9a" }}>Change Password</h3>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block mb-1 font-medium" style={{ color: "#6c9d9a" }}>Current Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2 bg-[#f3f7f7]"
                  style={{ borderColor: "#6c9d9a", color: "#222" }}
                  onFocus={e => e.target.style.boxShadow = `0 0 0 2px #6c9d9a`}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
              <div>
                <label className="block mb-1 font-medium" style={{ color: "#6c9d9a" }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2 bg-[#f3f7f7]"
                  style={{ borderColor: "#6c9d9a", color: "#222" }}
                  onFocus={e => e.target.style.boxShadow = `0 0 0 2px #6c9d9a`}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
              <div>
                <label className="block mb-1 font-medium" style={{ color: "#6c9d9a" }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2 bg-[#f3f7f7]"
                  style={{ borderColor: "#6c9d9a", color: "#222" }}
                  onFocus={e => e.target.style.boxShadow = `0 0 0 2px #6c9d9a`}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
              <button type="submit" className="px-6 py-2 rounded-lg font-semibold transition" style={{ background: "#6c9d9a", color: "#fff" }}>
                Change Password
              </button>
            </form>
          </div>
        </div>

        {/* Notification Preferences Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mt-8 border" style={{ borderColor: "#6c9d9a" }}>
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-6 w-6" style={{ color: "#6c9d9a" }} />
            <h3 className="text-xl font-semibold" style={{ color: "#6c9d9a" }}>Notification Preferences</h3>
          </div>
          <form className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <label className="font-medium" style={{ color: "#6c9d9a" }}>Email Notifications</label>
              <input
                type="checkbox"
                checked={emailNotif}
                onChange={() => setEmailNotif(v => !v)}
                className="h-5 w-5"
                style={{ accentColor: "#6c9d9a" }}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="font-medium" style={{ color: "#6c9d9a" }}>SMS Notifications</label>
              <input
                type="checkbox"
                checked={smsNotif}
                onChange={() => setSmsNotif(v => !v)}
                className="h-5 w-5"
                style={{ accentColor: "#6c9d9a" }}
              />
            </div>
          </form>
        </div>

        {/* Member Roles Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mt-8 border" style={{ borderColor: "#6c9d9a" }}>
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-6 w-6" style={{ color: "#6c9d9a" }} />
            <h3 className="text-xl font-semibold" style={{ color: "#6c9d9a" }}>Member Roles</h3>
          </div>
          <div className="space-y-3 mt-4">
            {roles.map((role, idx) => (
              <div key={role.name} className="flex items-center gap-4">
                <span className="font-medium w-32" style={{ color: "#6c9d9a" }}>{role.name}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={role.enabled}
                    onChange={() => handleRoleToggle(idx)}
                    className="h-5 w-5"
                    style={{ accentColor: "#6c9d9a" }}
                  />
                  <span style={{ color: role.enabled ? "#6c9d9a" : "#bbb" }}>
                    {role.enabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Message display */}
        {message && (
          <div className="mt-8 text-center">
            <div className="inline-block px-6 py-3 rounded-lg font-semibold shadow" style={{ background: "#6c9d9a", color: "#fff" }}>
              {message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
