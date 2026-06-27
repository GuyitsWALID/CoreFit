import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleModal } from "@/components/SimpleModal";
import type { MembershipInfo } from "@/types/memberships";

export type OfflineRenewalPackage = {
  id: string;
  name: string;
  price: number;
  duration_value: number;
  duration_unit: "days" | "weeks" | "months" | "years";
};

export type OfflineRenewalValues = {
  packageId: string;
  paymentDate: string;
  periodsPaid: number;
  amount: number;
  paymentMethod: string;
  remarks: string;
};

interface OfflineRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MembershipInfo | null;
  packages: OfflineRenewalPackage[];
  onSubmit: (values: OfflineRenewalValues) => Promise<void>;
  isProcessing: boolean;
}

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const addPackageDuration = (date: Date, pkg: OfflineRenewalPackage, periods = 1) => {
  const next = new Date(date);
  const durationValue = pkg.duration_value * periods;
  switch (pkg.duration_unit) {
    case "days":
      next.setDate(next.getDate() + durationValue);
      break;
    case "weeks":
      next.setDate(next.getDate() + durationValue * 7);
      break;
    case "months":
      next.setMonth(next.getMonth() + durationValue);
      break;
    case "years":
      next.setFullYear(next.getFullYear() + durationValue);
      break;
  }
  return next;
};

const toLocalDate = (value: string | null | undefined) => {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDate = (date: Date | null) => date ? date.toLocaleDateString() : "-";

export function OfflineRenewalModal({
  isOpen,
  onClose,
  member,
  packages,
  onSubmit,
  isProcessing,
}: OfflineRenewalModalProps) {
  const [packageId, setPackageId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayInputValue());
  const [periodsPaid, setPeriodsPaid] = useState("1");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("offline");
  const [remarks, setRemarks] = useState("");

  const selectedPackage = useMemo(
    () => packages.find(pkg => pkg.id === packageId) ?? null,
    [packages, packageId],
  );

  useEffect(() => {
    if (!isOpen || !member) return;
    const defaultPackage = packages.find(pkg => pkg.id === member.package_id) ?? packages[0] ?? null;
    setPackageId(defaultPackage?.id ?? "");
    setPaymentDate(todayInputValue());
    setPeriodsPaid("1");
    setAmount(defaultPackage?.price != null ? String(defaultPackage.price) : "");
    setPaymentMethod("offline");
    setRemarks("");
  }, [isOpen, member, packages]);

  useEffect(() => {
    const periods = Number(periodsPaid || 1);
    if (selectedPackage && Number.isInteger(periods) && periods > 0) {
      setAmount(String(Number(selectedPackage.price ?? 0) * periods));
    }
  }, [selectedPackage?.id, periodsPaid]);

  const preview = useMemo(() => {
    if (!member || !selectedPackage || !paymentDate) return null;
    const periods = Number(periodsPaid || 1);
    if (!Number.isInteger(periods) || periods < 1) return null;
    const paidAt = toLocalDate(paymentDate);
    if (!paidAt) return null;
    const currentExpiry = toLocalDate(member.membership_expiry);
    const startDate = currentExpiry && currentExpiry > paidAt ? currentExpiry : paidAt;
    return {
      startDate,
      newExpiry: addPackageDuration(startDate, selectedPackage, periods),
    };
  }, [member, paymentDate, periodsPaid, selectedPackage]);

  if (!isOpen || !member) return null;

  const amountNumber = Number(amount);
  const periodsPaidNumber = Number(periodsPaid);
  const canSubmit = Boolean(
    packageId &&
    paymentDate &&
    Number.isInteger(periodsPaidNumber) &&
    periodsPaidNumber >= 1 &&
    periodsPaidNumber <= 120 &&
    Number.isFinite(amountNumber) &&
    amountNumber >= 0
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      packageId,
      paymentDate,
      periodsPaid: periodsPaidNumber,
      amount: amountNumber,
      paymentMethod: paymentMethod.trim() || "offline",
      remarks: remarks.trim(),
    });
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Offline Renewal"
      icon={<CalendarClock className="h-5 w-5" />}
    >
      <div className="space-y-5">
        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          <div className="font-medium text-gray-900">{member.full_name}</div>
          <div>Current expiry: {formatDate(toLocalDate(member.membership_expiry))}</div>
        </div>

        <div className="space-y-2">
          <Label>Package</Label>
          <Select value={packageId} onValueChange={setPackageId}>
            <SelectTrigger>
              <SelectValue placeholder="Select package" />
            </SelectTrigger>
            <SelectContent>
              {packages.map(pkg => (
                <SelectItem key={pkg.id} value={pkg.id}>
                  {pkg.name} - ETB {Number(pkg.price || 0).toLocaleString()} / {pkg.duration_value} {pkg.duration_unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="offline-payment-date">Real payment date</Label>
            <Input
              id="offline-payment-date"
              type="date"
              value={paymentDate}
              max={todayInputValue()}
              onChange={event => setPaymentDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offline-periods-paid">Periods paid</Label>
            <Input
              id="offline-periods-paid"
              type="number"
              min="1"
              step="1"
              value={periodsPaid}
              onChange={event => setPeriodsPaid(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offline-amount">Amount</Label>
            <Input
              id="offline-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="offline-method">Payment method</Label>
          <Input
            id="offline-method"
            value={paymentMethod}
            onChange={event => setPaymentMethod(event.target.value)}
            placeholder="offline"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="offline-remarks">Note or source</Label>
          <Input
            id="offline-remarks"
            value={remarks}
            onChange={event => setRemarks(event.target.value)}
            placeholder="Paper receipt, spreadsheet row, receipt number..."
          />
        </div>

        <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
          <div>Calculated start: <strong>{formatDate(preview?.startDate ?? null)}</strong></div>
          <div>Periods paid: <strong>{periodsPaid || "1"}</strong></div>
          <div>New expiry: <strong>{formatDate(preview?.newExpiry ?? null)}</strong></div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isProcessing} type="button">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isProcessing} type="button">
            {isProcessing ? "Recording..." : "Record Renewal"}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
