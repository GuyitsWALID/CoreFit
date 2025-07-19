import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Clock, DollarSign, X } from "lucide-react";
import { useState, useEffect } from "react";

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

interface Trainer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  hourly_rate: number;
  specialization: string;
}

interface OneToOneCoachingModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MembershipInfo | null;
  trainers: Trainer[];
  onSubmit: (coachingData: CoachingSessionData) => void;
  isProcessing: boolean;
}

// Updated CoachingSessionData interface to match the simplified SQL schema
export interface CoachingSessionData {
  user_id: string;
  trainer_staff_id: string; // Changed from trainer_id to match SQL schema
  hourly_rate: number; // Added hourly_rate field
  days_per_week: number;
  hours_per_session: number;
  start_date: string;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
}

export function OneToOneCoachingModal({
  isOpen,
  onClose,
  member,
  trainers,
  onSubmit,
  isProcessing
}: OneToOneCoachingModalProps) {
  const [selectedTrainer, setSelectedTrainer] = useState<string>("");
  const [daysPerWeek, setDaysPerWeek] = useState<number>(1);
  const [hoursPerSession, setHoursPerSession] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>("");
  const [calculatedCost, setCalculatedCost] = useState<number>(0);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedTrainer("");
      setDaysPerWeek(1);
      setHoursPerSession(1);
      setStartDate("");
      setCalculatedCost(0);
    }
  }, [isOpen]);

  // Calculate cost when inputs change
  useEffect(() => {
    if (selectedTrainer && daysPerWeek && hoursPerSession) {
      const trainer = trainers.find(t => t.id === selectedTrainer);
      if (trainer) {
        const monthlyCost = trainer.hourly_rate * daysPerWeek * hoursPerSession * 4; // 4 weeks per month
        setCalculatedCost(monthlyCost);
      }
    } else {
      setCalculatedCost(0);
    }
  }, [selectedTrainer, daysPerWeek, hoursPerSession, trainers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!member || !selectedTrainer || !startDate) {
      return;
    }

    const trainer = trainers.find(t => t.id === selectedTrainer);
    if (!trainer) {
      return;
    }

    const coachingData: CoachingSessionData = {
      user_id: member.user_id,
      trainer_staff_id: selectedTrainer, // Using trainer_staff_id to match SQL schema
      hourly_rate: trainer.hourly_rate, // Include hourly_rate
      days_per_week: daysPerWeek,
      hours_per_session: hoursPerSession,
      start_date: startDate,
      status: 'active'
    };

    onSubmit(coachingData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Setup One-to-One Coaching</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {member && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{member.full_name}</span>
            </div>
            <p className="text-sm text-gray-600">{member.email}</p>
            <Badge variant="outline" className="mt-1">
              {member.package_name}
            </Badge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trainer Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Select Trainer</label>
            <Select value={selectedTrainer} onValueChange={setSelectedTrainer}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a trainer" />
              </SelectTrigger>
              <SelectContent>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    <div className="flex flex-col">
                      <span>{trainer.full_name}</span>
                      <span className="text-xs text-gray-500">
                        ${trainer.hourly_rate}/hr • {trainer.specialization}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Days per Week */}
          <div>
            <label className="block text-sm font-medium mb-1">Days per Week</label>
            <Select value={daysPerWeek.toString()} onValueChange={(value) => setDaysPerWeek(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                  <SelectItem key={days} value={days.toString()}>
                    {days} {days === 1 ? 'day' : 'days'} per week
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hours per Session */}
          <div>
            <label className="block text-sm font-medium mb-1">Hours per Session</label>
            <Select value={hoursPerSession.toString()} onValueChange={(value) => setHoursPerSession(parseFloat(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">30 minutes</SelectItem>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="1.5">1.5 hours</SelectItem>
                <SelectItem value="2">2 hours</SelectItem>
                <SelectItem value="2.5">2.5 hours</SelectItem>
                <SelectItem value="3">3 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Cost Breakdown */}
          {calculatedCost > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Cost Breakdown</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Hourly Rate:</span>
                  <span>${trainers.find(t => t.id === selectedTrainer)?.hourly_rate}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span>Sessions per Week:</span>
                  <span>{daysPerWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hours per Session:</span>
                  <span>{hoursPerSession}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between font-medium text-blue-900">
                  <span>Monthly Total:</span>
                  <span>${calculatedCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={!selectedTrainer || !startDate || isProcessing}
            >
              {isProcessing ? "Setting up..." : "Setup Coaching"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

