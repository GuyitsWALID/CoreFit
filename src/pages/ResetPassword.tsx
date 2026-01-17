import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPassword() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [debugResp, setDebugResp] = useState<any>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
    mode: 'onBlur',
  });

  const onSubmit = async (data: { email: string }) => {
    setIsLoading(true);
    setDebugResp(null);
    try {
      const redirectTo = `${window.location.origin}/reset-password/complete`;
      const resp = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo });
      console.log('resetPasswordForEmail response', resp);
      setDebugResp(resp);

      // Handle error case
      // resp.error or resp.data?.error depending on caret
      const err = (resp as any).error || null;
      if (err) {
        toast({ title: 'Reset failed', description: err.message || String(err), variant: 'destructive' });
        return;
      }

      // Success: note that Supabase sends email asynchronously. Provide guidance if not received.
      toast({ title: 'Reset email sent', description: 'If you do not receive an email, check spam or verify SMTP settings in your Supabase project.' });
    } catch (err: any) {
      console.error('reset error', err);
      setDebugResp({ error: err });
      toast({ title: 'Error', description: err?.message || 'Unexpected error', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-sm text-gray-600">Enter your account email and we'll send a password reset link.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Request password reset</CardTitle>
            <CardDescription>We will send a password reset link to your email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email address</label>
                <Input type="email" placeholder="you@yourgym.com" {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' } })} disabled={isLoading} />
                {errors.email && <div className="text-sm text-red-600 mt-1">{String(errors.email.message)}</div>}
              </div>

              <div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send reset link'}
                </Button>
              </div>

              {debugResp && (
                <div className="mt-4 p-3 bg-gray-50 border rounded text-sm">
                  <strong>Debug response:</strong>
                  <pre className="whitespace-pre-wrap text-xs mt-2">{JSON.stringify(debugResp, null, 2)}</pre>
                </div>
              )}

              {debugResp && !((debugResp as any).error) && Object.keys((debugResp as any).data ?? {}).length === 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <h4 className="font-semibold mb-2">Troubleshooting</h4>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Check your Supabase project SMTP settings: Dashboard → Settings → Email / SMTP. If SMTP is not configured, emails are not sent.</li>
                    <li>Verify <code className="bg-gray-100 px-1 rounded">Site URL</code> and allowed redirect URLs in Auth settings so the <code>redirectTo</code> you provide is accepted.</li>
                    <li>Check Auth / Email logs in the Supabase Dashboard for delivery errors or suppression.</li>
                    <li>Check your spam/junk folder; email delivery may be delayed.</li>
                    <li>If you want, share the debug response and your Supabase SMTP settings (safely) and I can help interpret them.</li>
                  </ul>
                  <p className="mt-2 text-xs text-gray-600">Docs: <a className="text-fitness-primary" href="https://supabase.com/docs/guides/auth#email" target="_blank" rel="noreferrer">supabase.com/docs/guides/auth#email</a></p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
