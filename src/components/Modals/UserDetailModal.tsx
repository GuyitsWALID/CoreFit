import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGym } from "@/contexts/GymContext";
import QRCode from 'react-qr-code';
import * as fileSaver from 'file-saver';
import { jsPDF } from 'jspdf';
import { useToast } from '@/hooks/use-toast';

interface UserDetailModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserDetailModal({ userId, isOpen, onClose }: UserDetailModalProps) {
  const { gym } = useGym();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!(isOpen && userId && gym?.id)) return;

    let mounted = true;
    const fetchUser = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("users")
          .select("id, first_name, last_name, email, phone, date_of_birth, gender, package_id, packages(name), emergency_name, emergency_phone, qr_code_data")
          .eq("id", userId)
          .eq("gym_id", gym.id) // Ensure user belongs to this gym
          .single();
        if (mounted) setUser(data);
      } catch (err) {
        // swallow - UI will show not found
        console.error('Failed to fetch user details', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUser();
    return () => { mounted = false; };
  }, [isOpen, userId, gym?.id]);

  const { toast } = useToast();

  const getSvgElement = (): SVGSVGElement | null => {
    const container = svgRef.current;
    if (container) return container;
    // fallback: try to find the svg in DOM by id
    const el = document.getElementById(`user-qrcode-${userId}`)?.querySelector('svg');
    return (el as SVGSVGElement) || null;
  };

  const [generating, setGenerating] = useState(false);

  // Consistency metrics derived from client_checkins (first/last check-in, months active using span between first & last month)
  const [consistency, setConsistency] = useState<{
    first_checkin?: string | null;
    last_checkin?: string | null;
    total_checkins: number;
    months_active: number;
    avg_per_month: number;
  } | null>(null);

  useEffect(() => {
    if (!(isOpen && userId && gym?.id)) { setConsistency(null); return; }

    let mounted = true;
    const fetchCheckins = async () => {
      try {
        const { data, error } = await supabase
          .from('client_checkins')
          .select('id, checkin_time')
          .eq('user_id', userId)
          .eq('gym_id', gym.id)
          .order('checkin_time', { ascending: true });
        if (error) throw error;
        if (!mounted) return;
        const rows = data || [];
        if (rows.length === 0) {
          setConsistency({ first_checkin: null, last_checkin: null, total_checkins: 0, months_active: 0, avg_per_month: 0 });
          return;
        }
        const first = rows[0].checkin_time || null;
        const last = rows[rows.length - 1].checkin_time || null;
        const total = rows.length;
        const monthsBetween = (a: string, b: string) => {
          const da = new Date(a);
          const db = new Date(b);
          return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth()) + 1;
        };
        const months = (first && last) ? monthsBetween(first, last) : 0;
        const avg = months > 0 ? total / months : 0;
        setConsistency({ first_checkin: first, last_checkin: last, total_checkins: total, months_active: months, avg_per_month: avg });
      } catch (err) {
        console.error('Failed to fetch checkins', err);
      }
    };

    fetchCheckins();
    return () => { mounted = false; };
  }, [isOpen, userId, gym?.id]);

  const copyQrToClipboard = async () => {
    if (!user?.qr_code_data) return;
    try {
      await navigator.clipboard.writeText(typeof user.qr_code_data === 'string' ? user.qr_code_data : JSON.stringify(user.qr_code_data));
      toast({ title: 'Copied', description: 'QR payload copied to clipboard.' });
    } catch (err) {
      toast({ title: 'Copy failed', description: String(err), variant: 'destructive' });
    }
  };

  const generateOrUpdateQr = async () => {
    if (!user || !gym?.id) return;
    setGenerating(true);
    try {
      const qrData = JSON.stringify({
        userId: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        packageId: user.package_id || null,
        gymId: gym.id,
      });

      const { error } = await supabase
        .from('users')
        .update({ qr_code_data: qrData })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Update local state so UI shows the QR immediately
      setUser({ ...user, qr_code_data: qrData });
      toast({ title: 'QR saved', description: 'QR data saved to user profile.' });
    } catch (err: any) {
      console.error('Failed to generate QR', err);
      toast({ title: 'QR generation failed', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const downloadSVG = () => {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    // add name spaces
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    // add xml declaration
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    fileSaver.saveAs(blob, `qr-${userId}.svg`);
  };

  const svgToImageDataUrl = async (type: 'image/png' | 'image/jpeg', quality = 0.92) => {
    const svgEl = getSvgElement();
    if (!svgEl) return null;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL(type, quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  };

  const downloadPNG = async () => {
    const dataUrl = await svgToImageDataUrl('image/png');
    if (!dataUrl) return;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    fileSaver.saveAs(blob, `qr-${userId}.png`);
  };

  const downloadJPG = async () => {
    const dataUrl = await svgToImageDataUrl('image/jpeg', 0.95);
    if (!dataUrl) return;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    fileSaver.saveAs(blob, `qr-${userId}.jpg`);
  };

  const downloadPDF = async () => {
    const dataUrl = await svgToImageDataUrl('image/png');
    if (!dataUrl) return;
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((res) => { img.onload = () => res(); });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.drawImage(img, 0,0);
    const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`qr-${userId}.pdf`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : user ? (
          <div className="space-y-4">
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

            <div className="mt-4">
              <h4 className="mb-2 font-medium">Consistency</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>First check-in:</strong> {consistency?.first_checkin ? new Date(consistency.first_checkin).toLocaleDateString() : '-'}</div>
                <div><strong>Last check-in:</strong> {consistency?.last_checkin ? new Date(consistency.last_checkin).toLocaleDateString() : '-'}</div>
                <div><strong>Months active:</strong> {consistency ? (consistency.months_active || 0) : '-'}</div>
                <div><strong>Total check-ins:</strong> {consistency ? consistency.total_checkins : '-'}</div>
                <div className="col-span-2"><strong>Avg/month:</strong> {consistency ? consistency.avg_per_month.toFixed(1) : '-'}</div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="mb-2 font-medium">QR Code</h4>
              {user.qr_code_data ? (
                <div className="flex items-start gap-4">
                  <div className="bg-white p-2 rounded" id={`user-qrcode-${userId}`} ref={svgRef as any}>
                    <QRCode value={typeof user.qr_code_data === 'string' ? user.qr_code_data : JSON.stringify(user.qr_code_data)} size={176} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={downloadSVG} variant="ghost">Download .svg</Button>
                    <Button onClick={downloadPNG} variant="ghost">Download .png</Button>
                    <Button onClick={downloadJPG} variant="ghost">Download .jpg</Button>
                    <Button onClick={downloadPDF} variant="ghost">Download .pdf</Button>
                    <Button onClick={copyQrToClipboard} variant="ghost">Copy payload</Button>
                    <div className="mt-2 text-sm text-muted-foreground break-all max-w-xs">{typeof user.qr_code_data === 'string' ? user.qr_code_data : JSON.stringify(user.qr_code_data)}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div>No QR code available for this user.</div>
                  <div className="ml-4">
                    <Button onClick={generateOrUpdateQr} disabled={generating}>{generating ? 'Generating...' : 'Generate QR'}</Button>
                  </div>
                </div>
              )}
            </div>

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
