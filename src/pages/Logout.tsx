import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function Logout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    // In a real app, we'd handle the logout logic here
    toast({
      title: "Logged out successfully",
      description: "You have been logged out of your account.",
    });
    
    // Redirect to admin login after a brief delay
    setTimeout(() => {
      navigate('/admin/login');
    }, 1500);
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
