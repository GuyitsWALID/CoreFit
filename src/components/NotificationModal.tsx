import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bell } from "lucide-react";
import { SimpleModal } from "./SimpleModal";

interface MembershipInfo {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  package_id: string;
  package_name: string;
  created_at: string;
  membership_expiry: string;
  status: string;
  days_left: number;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MembershipInfo | null;
  title: string;
  setTitle: (value: string) => void;
  message: string;
  setMessage: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
}

export function NotificationModal({
  isOpen,
  onClose,
  member,
  title,
  setTitle,
  message,
  setMessage,
  onSend,
  isSending
}: NotificationModalProps) {
  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Send Notification"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Send a notification to {member?.full_name}
        </p>
        
        <div>
          <label className="text-sm font-medium text-gray-700">Recipient</label>
          <Input
            value={member?.full_name || ""}
            disabled
            className="mt-1 bg-gray-50"
          />
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-700">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            className="mt-1"
            autoComplete="off"
          />
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-700">Message</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Notification message"
            className="mt-1"
            rows={4}
            autoComplete="off"
          />
        </div>
        
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onSend}
            disabled={isSending}
            type="button"
          >
            <Bell className="mr-2 h-4 w-4" />
            {isSending ? "Sending..." : "Send Notification"}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
