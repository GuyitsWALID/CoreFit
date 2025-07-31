import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleModal } from '../SimpleModal';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/supabaseClient';

export type FreezeMode = 'freeze' | 'extend';

interface FreezeActionModalProps {
  isOpen: boolean;
  mode: FreezeMode;
  userId: string;
  userName: string;
  defaultDays?: number;
  onClose: () => void;
  onConfirm: (days: number) => Promise<void>;
  isProcessing?: boolean;
}

export default function FreezeActionModal({
  isOpen,
  mode,
  userId,
  userName,
  defaultDays = 0,
  onClose,
  onConfirm,
  isProcessing = false,
}: FreezeActionModalProps) {
  const [days, setDays] = useState<number>(defaultDays);
  const [remaining, setRemaining] = useState<number | null>(null);

  // reset input and reload remaining when opening
 useEffect(() => {
  if (!isOpen) return;

  (async () => {
    try {
      const { data, error } = await supabase
        .rpc('total_freeze_days_left', { p_user_id: userId });

      if (error) {
        console.error('RPC error:', error);
        toast({
          title: 'Could not load remaining days',
          description: error.message,
          variant: 'destructive',
        });
        setRemaining(null);
        return;
      }

      // data _might_ come back as a plain number, or as an array [number], or as { total: number }
      let value: number | null = null;

      if (typeof data === 'number') {
        value = data;
      } else if (Array.isArray(data) && typeof data[0] === 'number') {
        value = data[0];
      } else if (
        data !== null &&
        typeof data === 'object' &&
        Object.values(data).some(v => typeof v === 'number')
      ) {
        // e.g. { total_freeze_days_left: 7 }
        value = Object.values(data).find((v) => typeof v === 'number') as number;
      }

      console.log('RPC total_freeze_days_left returned:', data, 'normalized to', value);

      setRemaining(value);
    } catch (err) {
      console.error('Unexpected error fetching remaining days', err);
      toast({
        title: 'Could not load remaining days',
        description: 'Unexpected error',
        variant: 'destructive',
      });
      setRemaining(null);
    }
  })();
}, [isOpen, userId, toast]);


  const title = mode === 'freeze' ? 'Freeze Membership' : 'Extend Freeze';
  const confirmLabel = mode === 'freeze' ? 'Confirm Freeze' : 'Confirm Extension';

  const handleSubmit = async () => {
    if (days <= 0) {
      toast({
        title: 'Invalid number',
        description: 'Please enter a positive number of days.',
        variant: 'destructive',
      });
      return;
    }
    if (remaining !== null && mode === 'extend' && days > remaining) {
      toast({
        title: 'Too many days',
        description: `Only ${remaining} day${remaining !== 1 ? 's' : ''} left to extend.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      await onConfirm(days);
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  return (
    <SimpleModal isOpen={isOpen} onClose={onClose} title={`${title} for ${userName}`}>
      <div className="space-y-4">
  <h2 className="text-lg font-semibold">{title}</h2>
  <p>
    How many days would you like to{' '}
    <strong>{mode === 'freeze' ? 'freeze' : 'extend'}</strong>{' '}
    <strong>{userName}</strong>’s membership?
  </p>

  {remaining !== null ? (
    <p className="text-sm text-gray-800">
      Remaining freeze days: <strong className='text-sm text-red-600'>{remaining}</strong> day{remaining !== 1 ? 's' : ''}
    </p>
  ) : (
    <p className="text-sm text-gray-400">Loading remaining days…</p>
  )}

        <Input
          type="number"
          min={1}
          value={days > 0 ? days : ''}
          onChange={(e) => setDays(parseInt(e.target.value, 10) || 0)}
          placeholder="Enter days"
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (mode === 'freeze' ? 'Freezing…' : 'Extending…') : confirmLabel}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
