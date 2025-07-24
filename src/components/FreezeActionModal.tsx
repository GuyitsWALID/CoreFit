import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleModal } from './SimpleModal';
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

  // reset input when opening
  useEffect(() => {
    if (isOpen) setDays(defaultDays);
  }, [isOpen, defaultDays]);

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
        <p>
          How many days would you like to <strong>{mode === 'freeze' ? 'freeze' : 'extend'} </strong>
          <strong>{userName}</strong>’s membership?
        </p>
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
