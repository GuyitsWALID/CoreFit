import React, { useEffect, useState } from 'react';
import { LockKeyhole, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const accessKey = 'corefit:super-admin-entry';

const functionsBase =
  (import.meta.env.VITE_MIGRATE_FUNCTIONS_BASE as string | undefined)
  ?? `${String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1`;

export const hasSuperAdminEntry = () => sessionStorage.getItem(accessKey) === 'granted';

export function AdminHotkeyGate() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && !event.altKey && event.code === 'KeyM') {
        event.preventDefault();
        event.stopPropagation();
        setCode('');
        setError('');
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      setError('Enter the team access code.');
      return;
    }

    setChecking(true);
    setError('');
    try {
      const response = await fetch(`${functionsBase}/verify-admin-hotkey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.valid) {
        throw new Error(payload.error || 'Invalid access code.');
      }
      sessionStorage.setItem(accessKey, 'granted');
      window.location.assign('/admin/login');
    } catch (verificationError: any) {
      setError(verificationError.message || 'Could not verify the access code.');
      setCode('');
    } finally {
      setChecking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex gap-3">
            <div className="rounded-full bg-blue-100 p-3 text-blue-700">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Team access code</h2>
              <p className="mt-1 text-sm text-gray-500">Enter the private code to reveal Super Admin login.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={verify} className="space-y-4">
          <Input
            autoFocus
            type="password"
            autoComplete="off"
            value={code}
            onChange={event => setCode(event.target.value)}
            placeholder="Access code"
            disabled={checking}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={checking}>
            {checking ? 'Verifying…' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}
