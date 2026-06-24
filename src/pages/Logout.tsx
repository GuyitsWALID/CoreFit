import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

export default function Logout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    const logout = async () => {
      const { error } = await supabase.auth.signOut();
      sessionStorage.removeItem('corefit:super-admin-entry');
      toast({
        title: error ? "Logout warning" : "Logged out successfully",
        description: error?.message || "You have been logged out of your account.",
        variant: error ? "destructive" : "default",
      });
      navigate('/login', { replace: true });
    };
    logout();
  }, [navigate, toast]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Logging out...</h1>
        <p className="text-muted-foreground">Please wait while we securely log you out.</p>
      </div>
    </div>
  );
}
