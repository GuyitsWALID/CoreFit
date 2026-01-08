import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGym } from "@/contexts/GymContext";

interface UserDetailModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserDetailModal({ userId, isOpen, onClose }: UserDetailModalProps) {
  const { gym } = useGym();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId && gym?.id) {
      setLoading(true);
      supabase
        .from("users")
        .select("id, first_name, last_name, email, phone, date_of_birth, gender, package_id, packages(name), emergency_name, emergency_phone")
        .eq("id", userId)
        .eq("gym_id", gym.id) // Ensure user belongs to this gym
        .single()
        .then(({ data }) => {
          setUser(data);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, userId, gym?.id]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : user ? (
          <div className="space-y-2">
            <div><strong>Name:</strong> {user.first_name} {user.last_name}</div>
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>Phone:</strong> {user.phone}</div>
            <div><strong>Date of Birth:</strong> {user.date_of_birth || "-"}</div>
            <div><strong>Gender:</strong> {user.gender || "-"}</div>
            <div><strong>Package:</strong> {user.packages?.name || "-"}</div>
            <div><strong>Emergency Contact Name:</strong> {user.emergency_name || "-"}</div>
            <div><strong>Emergency Contact Phone:</strong> {user.emergency_phone || "-"}</div>
          </div>
        ) : (
          <div className="py-8 text-center text-red-500">User not found.</div>
        )}
        <DialogFooter>
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
