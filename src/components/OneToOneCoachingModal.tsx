import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Clock, DollarSign, X } from "lucide-react";
import { useState, useEffect } from "react";
import type { MembershipInfo } from "@/types/memberships";
import { Trainer, CoachingSessionData } from "@/types/coaching"; 
import { supabase } from "@/supabaseClient";

// Updated Trainer interface to match staff table structure


interface OneToOneCoachingModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MembershipInfo | null;
  trainers: Trainer[];
  onSubmit: (coachingData: CoachingSessionData) => void;
  isProcessing: boolean;
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
  const [hourlyRate, setHourlyRate] = useState<string>(""); // Changed to string for input handling
  const [daysPerWeek, setDaysPerWeek] = useState<number>(1);
  const [hoursPerSession, setHoursPerSession] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [weeklyPrice, setWeeklyPrice] = useState<number>(0);
  const [monthlyPrice, setMonthlyPrice] = useState<number>(0);


  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedTrainer("");
      setHourlyRate("");
      setDaysPerWeek(1);
      setHoursPerSession(1);
      setStartDate("");
      setEndDate("");
      setWeeklyPrice(0);
      setMonthlyPrice(0);
    }
  }, [isOpen]);

  

  // Calculate weekly and monthly prices when inputs change
  useEffect(() => {
    const rate = parseFloat(hourlyRate);
    if (rate > 0 && daysPerWeek > 0 && hoursPerSession > 0) {
      const weekly = rate * daysPerWeek * hoursPerSession;
      const monthly = weekly * 4; // Average weeks per month (52/12)
      setWeeklyPrice(weekly);
      setMonthlyPrice(monthly);
    } else {
      setWeeklyPrice(0);
      setMonthlyPrice(0);
    }
  }, [hourlyRate, daysPerWeek, hoursPerSession]);

  const handleHourlyRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string or valid decimal numbers
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setHourlyRate(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!member || !selectedTrainer || !startDate || !hourlyRate) {
      return;
    }

    const rate = parseFloat(hourlyRate);
    if (rate <= 0) {
      return;
    }

    const coachingData: CoachingSessionData = {
      user_id: member.user_id,
      trainer_id: selectedTrainer,
      hourly_rate: rate,
      days_per_week: daysPerWeek,
      hours_per_session: hoursPerSession,
      start_date: startDate,
      end_date: endDate || undefined,
      status: 'active',
      weekly_price: weeklyPrice,
      monthly_price: monthlyPrice
    };

    onSubmit(coachingData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
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
                        {trainer.email}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hourly Rate Input */}
          <div>
            <label className="block text-sm font-medium mb-1">Hourly Rate (Birr)</label>
            <Input
              type="text"
              value={hourlyRate}
              onChange={handleHourlyRateChange}
              placeholder="Enter hourly rate (e.g., 500.00)"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the hourly rate for this coaching session
            </p>
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
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="1.5">1.5 hours</SelectItem>
                <SelectItem value="2">2 hours</SelectItem>
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

          {/* End Date (Optional) */}
          <div>
            <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for ongoing coaching
            </p>
          </div>

          {/* Cost Breakdown */}
          {weeklyPrice > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Cost Breakdown</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Hourly Rate:</span>
                  <span>ETB {parseFloat(hourlyRate).toFixed(2)}/hr</span>
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
                  <span>Weekly Total:</span>
                  <span>ETB {weeklyPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium text-blue-900">
                  <span>Monthly Total:</span>
                  <span>ETB {monthlyPrice.toFixed(2)}</span>
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
              disabled={!selectedTrainer || !startDate || !hourlyRate || parseFloat(hourlyRate) <= 0 || isProcessing}
            >
              {isProcessing ? "Setting up..." : "Setup Coaching"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
