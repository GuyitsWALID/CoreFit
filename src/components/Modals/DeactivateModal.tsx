import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SimpleModal } from '../SimpleModal';

interface DeactivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName: string;
  currentStatus: 'active' | 'inactive';
  onConfirm: (reason: string) => Promise<void>;
}

export default function DeactivateModal({
  isOpen,
  onClose,
  memberName,
  currentStatus,
  onConfirm,
}: DeactivateModalProps) {
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleYes = async () => {
    if (!reason.trim()) return;
    setProcessing(true);
    await onConfirm(reason);
    setProcessing(false);
    setReason('');
    onClose();
  };

  if (!isOpen) return null;
  return (
    <SimpleModal isOpen={isOpen} onClose={onClose} title={`${currentStatus === 'active' ? 'Deactivate' : 'Activate'} ${memberName}`}>
      <div className="space-y-4">
        <p className="text-sm">
          {currentStatus === 'active'
            ? `Please confirm deactivation and provide a reason for ${memberName}'s membership.`
            : `Please confirm re-activation and provide a reason for ${memberName}'s membership.`}
        </p>
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          placeholder="Reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            No
          </Button>
          <Button onClick={handleYes} disabled={processing || !reason.trim()}>
            {processing ? 'Submitting…' : 'Yes'}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
