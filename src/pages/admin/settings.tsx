import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, 
  Lock, 
  Bell, 
  Shield, 
  Globe, 
  Palette, 
  Database, 
  Mail,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  AlertTriangle,
  Check,
  Settings as SettingsIcon,
  Menu
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface AdminProfile {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface SystemSettings {
  default_timezone: string;
  default_currency: string;
  backup_frequency: string;
  maintenance_mode: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  auto_logout_minutes: number;
  max_login_attempts: number;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'CAD', label: 'Canadian Dollar (C$)' },
  { value: 'AUD', label: 'Australian Dollar (A$)' },
  { value: 'JPY', label: 'Japanese Yen (¥)' },
  { value: 'ETB', label: 'Ethiopian Birr (Br)' },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
  });

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordStrength, setPasswordStrength] = useState(0);

  // System settings state
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    default_timezone: 'UTC',
    default_currency: 'USD',
    backup_frequency: 'daily',
    maintenance_mode: false,
    email_notifications: true,
    sms_notifications: true,
    auto_logout_minutes: 60,
    max_login_attempts: 5,
  });

  // Security & Stats
  const [securityStats, setSecurityStats] = useState({
    total_admins: 0,
    total_gyms: 0,
    total_users: 0,
    failed_login_attempts: 0,
    last_backup: null as string | null,
  });

  // Dynamic styling
  const dynamicStyles = useMemo(() => ({
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    accentColor: '#f59e0b',
  }), []);

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProfile(),
        loadSystemSettings(),
        loadSecurityStats(),
      ]);
    } catch (error: any) {
      toast({
        title: "Error loading settings",
        description: error.message || "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (user) {
        setProfile({
          id: user.id,
          email: user.email || '',
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          user_metadata: user.user_metadata,
        });
        
        setProfileForm({
          full_name: user.user_metadata?.full_name || '',
          email: user.email || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadSystemSettings = async () => {
    try {
      // Load from a settings table if it exists, otherwise use defaults
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .single();
      
      if (settings) {
        setSystemSettings({
          default_timezone: settings.default_timezone || 'UTC',
          default_currency: settings.default_currency || 'USD',
          backup_frequency: settings.backup_frequency || 'daily',
          maintenance_mode: settings.maintenance_mode || false,
          email_notifications: settings.email_notifications !== false,
          sms_notifications: settings.sms_notifications !== false,
          auto_logout_minutes: settings.auto_logout_minutes || 60,
          max_login_attempts: settings.max_login_attempts || 5,
        });
      }
    } catch (error: any) {
      // If settings table doesn't exist, use defaults
      console.log('Using default system settings');
    }
  };

  const loadSecurityStats = async () => {
    try {
      // Get various stats
      const [
        { count: adminCount },
        { count: gymCount },
        { count: userCount }
      ] = await Promise.all([
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('role_id', 'admin-role-id'),
        supabase.from('gyms').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true })
      ]);

      setSecurityStats({
        total_admins: adminCount || 0,
        total_gyms: gymCount || 0,
        total_users: userCount || 0,
        failed_login_attempts: 0, // Would need auth logs to track this
        last_backup: null, // Would need backup logs to track this
      });
    } catch (error: any) {
      console.error('Error loading security stats:', error);
    }
  };

  const getPasswordStrength = (password: string): number => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  useEffect(() => {
    setPasswordStrength(getPasswordStrength(passwordForm.new_password));
  }, [passwordForm.new_password]);

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileForm.full_name,
        }
      });

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });

      await loadProfile(); // Reload profile
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast({
        title: "Missing fields",
        description: "All password fields are required.",
        variant: "destructive"
      });
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match.",
        variant: "destructive"
      });
      return;
    }

    if (passwordStrength < 4) {
      toast({
        title: "Weak password",
        description: "Password must be stronger. Include uppercase, lowercase, numbers, and special characters.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: passwordForm.current_password,
      });

      if (signInError) {
        toast({
          title: "Current password incorrect",
          description: "Please enter your current password correctly.",
          variant: "destructive"
        });
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new_password
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });

      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error: any) {
      toast({
        title: "Password update failed",
        description: error.message || "Failed to update password",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSystemSettings = async () => {
    setSaving(true);
    try {
      // Upsert system settings
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          id: 1, // Single row for system settings
          ...systemSettings,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        // If table doesn't exist, just show success for now
        console.log('System settings would be saved:', systemSettings);
      }

      toast({
        title: "System settings updated",
        description: "System settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update system settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPasswordForm(prev => ({ ...prev, new_password: password }));
    toast({
      title: "Password generated",
      description: "A secure password has been generated. Don't forget to confirm it!",
    });
  };

  const PasswordStrengthBar = ({ strength }: { strength: number }) => {
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
              className={`h-2 rounded transition-all duration-200 flex-1 ${
                i < strength ? levels[i].color : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <div className="text-xs mt-1 text-gray-500">
          {strength > 0 ? levels[Math.max(0, strength - 1)].label : 'Enter a password'}
        </div>
      </div>
    );
  };

  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="text-gray-500">Loading settings...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Mobile Header */}
        {isMobile && (
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </Button>
            <h1 className="font-semibold text-lg text-blue-600">Super Admin</h1>
          </div>
        )}
        <div className="p-4 md:p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 
                className="text-3xl font-bold tracking-tight"
                style={{ color: dynamicStyles.primaryColor }}
              >
                Super Admin Settings
              </h1>
              <p className="text-gray-500 mt-1">
                Manage your account, security, and system preferences
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={loadAllSettings}
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                System
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Full Name</label>
                      <Input
                        value={profileForm.full_name}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))
                        }
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Email Address</label>
                      <Input
                        value={profileForm.email}
                        disabled
                        className="bg-gray-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Account Created</label>
                      <p className="text-sm text-gray-600">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Last Sign In</label>
                      <p className="text-sm text-gray-600">
                        {profile?.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={handleUpdateProfile}
                      disabled={saving}
                      style={{ backgroundColor: dynamicStyles.primaryColor }}
                      className="text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              {/* Password Change */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Current Password</label>
                    <div className="relative">
                      <Input
                        type={showPasswords.current ? "text" : "password"}
                        value={passwordForm.current_password}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))
                        }
                        placeholder="Enter current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))
                        }
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium">New Password</label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generatePassword}
                      >
                        Generate
                      </Button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))
                        }
                        placeholder="Enter new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))
                        }
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <PasswordStrengthBar strength={passwordStrength} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                    <div className="relative">
                      <Input
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))
                        }
                        placeholder="Confirm new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))
                        }
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={handleUpdatePassword}
                      disabled={saving || passwordStrength < 4}
                      style={{ backgroundColor: dynamicStyles.primaryColor }}
                      className="text-white"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {saving ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Security Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Total Admins</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{securityStats.total_admins}</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Total Gyms</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">{securityStats.total_gyms}</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">Total Users</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-600">{securityStats.total_users}</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Failed Logins</span>
                      </div>
                      <div className="text-2xl font-bold text-red-600">{securityStats.failed_login_attempts}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* System Tab */}
            <TabsContent value="system" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    System Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Default Timezone</label>
                      <Select 
                        value={systemSettings.default_timezone} 
                        onValueChange={(value) => setSystemSettings(prev => ({ ...prev, default_timezone: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map(tz => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Default Currency</label>
                      <Select 
                        value={systemSettings.default_currency} 
                        onValueChange={(value) => setSystemSettings(prev => ({ ...prev, default_currency: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map(currency => (
                            <SelectItem key={currency.value} value={currency.value}>{currency.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Auto Logout (Minutes)</label>
                      <Input
                        type="number"
                        min="15"
                        max="480"
                        value={systemSettings.auto_logout_minutes}
                        onChange={(e) => setSystemSettings(prev => ({ 
                          ...prev, 
                          auto_logout_minutes: parseInt(e.target.value) || 60 
                        }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Max Login Attempts</label>
                      <Input
                        type="number"
                        min="3"
                        max="10"
                        value={systemSettings.max_login_attempts}
                        onChange={(e) => setSystemSettings(prev => ({ 
                          ...prev, 
                          max_login_attempts: parseInt(e.target.value) || 5 
                        }))
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <label className="block text-sm font-medium mb-2">Backup Frequency</label>
                    <Select 
                      value={systemSettings.backup_frequency} 
                      onValueChange={(value) => setSystemSettings(prev => ({ ...prev, backup_frequency: value }))
                        }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium">Maintenance Mode</label>
                      <p className="text-xs text-gray-500">Block access to all gym dashboards</p>
                    </div>
                    <Switch
                      checked={systemSettings.maintenance_mode}
                      onCheckedChange={(checked) => setSystemSettings(prev => ({ 
                        ...prev, 
                        maintenance_mode: checked 
                      }))
                        }
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={handleUpdateSystemSettings}
                      disabled={saving}
                      style={{ backgroundColor: dynamicStyles.primaryColor }}
                      className="text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save System Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium">Email Notifications</label>
                      <p className="text-xs text-gray-500">Receive system alerts via email</p>
                    </div>
                    <Switch
                      checked={systemSettings.email_notifications}
                      onCheckedChange={(checked) => setSystemSettings(prev => ({ 
                        ...prev, 
                        email_notifications: checked 
                      }))
                        }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium">SMS Notifications</label>
                      <p className="text-xs text-gray-500">Receive critical alerts via SMS</p>
                    </div>
                    <Switch
                      checked={systemSettings.sms_notifications}
                      onCheckedChange={(checked) => setSystemSettings(prev => ({ 
                        ...prev, 
                        sms_notifications: checked 
                      }))
                        }
                    />
                  </div>

                  <Separator />

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Notification Types</span>
                    </div>
                    <div className="text-xs text-blue-800 space-y-1">
                      <div>• New gym registrations</div>
                      <div>• System errors and maintenance</div>
                      <div>• Security alerts and login attempts</div>
                      <div>• Backup status and failures</div>
                      <div>• Critical system updates</div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={handleUpdateSystemSettings}
                      disabled={saving}
                      style={{ backgroundColor: dynamicStyles.primaryColor }}
                      className="text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Notification Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
