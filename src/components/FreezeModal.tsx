import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleModal } from './SimpleModal';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/supabaseClient';

interface FreezeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSuccess: () => void;
}

export default function FreezeModal({
  isOpen,
  onClose,
  userId,
  userName,
  onSuccess,
}: FreezeModalProps) {
  const [days, setDays] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (days <= 0) {
      toast({
        title: 'Invalid number',
        description: 'Please enter a positive number of days.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .rpc('freeze_membership', {
        p_user_id: userId,
        p_days: days,
      });

    setSaving(false);

    if (error) {
      toast({
        title: 'Freeze failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Membership frozen',
        description: `${userName} has been frozen for ${days} day${days > 1 ? 's' : ''}.`,
      });
      onSuccess();
      onClose();
    }
  };

  return (
    <SimpleModal isOpen={isOpen} onClose={onClose} title="Freeze Membership">
      <div className="space-y-4">
        <p>
          How many days would you like to freeze <strong>{userName}</strong>’s membership?
        </p>
        <Input
          type="number"
          min={1}
          value={days > 0 ? days : ''}
          onChange={(e) => setDays(parseInt(e.target.value, 10) || 0)}
          placeholder="Enter days"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Freezing…' : 'Confirm Freeze'}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
