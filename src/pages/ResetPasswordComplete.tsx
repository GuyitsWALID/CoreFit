import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordComplete() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const { register, handleSubmit } = useForm<{ password: string }>();

  useEffect(() => {
    // Try to detect access token in URL (query or hash)
    const searchParams = new URLSearchParams(window.location.search);
    let token = searchParams.get('access_token') || null;
    if (!token) {
      // sometimes token in hash fragment: #access_token=...
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      token = hashParams.get('access_token') || null;
    }
    if (token) {
      setHasToken(true);
      // set session briefly so updateUser works
      (async () => {
        try {
          await supabase.auth.setSession({ access_token: token, refresh_token: '' } as any);
        } catch (e) {
          console.warn('setSession failed', e);
        }
      })();
    }
  }, []);

  const onSubmit = async (data: { password: string }) => {
    setIsLoading(true);
    try {
      const { data: res, error } = await supabase.auth.updateUser({ password: data.password });
      if (error) {
        toast({ title: 'Failed', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
      // Optionally redirect to login
      window.location.href = '/login';
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Unexpected error', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-sm text-gray-600">Enter a new password to finish the password reset process.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>Make sure it is a strong password.</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasToken && (
              <div className="p-4 bg-yellow-50 rounded mb-4">No reset token detected. Please open the link from your email to set a new password.</div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New password</label>
                <Input type="password" placeholder="New password" {...register('password', { required: true, minLength: 6 })} />
              </div>

              <div>
                <Button type="submit" className="w-full" disabled={isLoading || !hasToken}>
                  {isLoading ? 'Updating...' : 'Set new password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
