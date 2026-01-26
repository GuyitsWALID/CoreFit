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
  // container ref for the QR svg
  const svgRef = useRef<HTMLDivElement | null>(null);

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
    const svgFromRef = container?.querySelector ? (container.querySelector('svg') as SVGSVGElement | null) : null;
    const el = document.getElementById(`user-qrcode-${userId}`)?.querySelector('svg');
    // debug info to help diagnose button failures
    try { console.debug('[UserDetailModal] getSvgElement', { foundInRef: !!svgFromRef, foundFallback: !!el, userId }); } catch (e) {}
    if (svgFromRef) return svgFromRef;
    return (el as SVGSVGElement) || null;
  };

  const [generating, setGenerating] = useState(false);
  // visible status for user actions to help debug clicks and progress
  const [actionStatus, setActionStatus] = useState<string | null>(null);

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

  // Extract a simple QR id from stored qr_code_data (prefer explicit userId/staffId/id in JSON, else raw string)
  const getQrId = (raw: any): string | null => {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) return parsed.userId;
        if (parsed?.staffId) return parsed.staffId;
        if (parsed?.id) return parsed.id;
        return raw;
      } catch (e) {
        return raw;
      }
    }
    if (typeof raw === 'object') {
      if (raw.userId) return raw.userId;
      if (raw.staffId) return raw.staffId;
      if (raw.id) return raw.id;
      return JSON.stringify(raw);
    }
    return String(raw);
  };

  // Prefer an explicit id extracted from stored QR payload, fallback to user.id
  const qrId = getQrId(user?.qr_code_data) ?? user?.id ?? null;
  const qrValueForRender = qrId ?? (typeof user?.qr_code_data === 'string' ? user.qr_code_data : JSON.stringify(user?.qr_code_data || ''));

  const copyQrToClipboard = async () => {
    const toCopy = qrId ?? user?.id;
    if (!toCopy) return;
    // Try navigator.clipboard first
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(toCopy);
        toast({ title: 'Copied', description: 'QR id copied to clipboard.' });
        return;
      }
    } catch (err) {
      console.warn('navigator.clipboard failed', err);
    }

    // Fallback: textarea copy
    try {
      const ta = document.createElement('textarea');
      ta.value = toCopy;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        toast({ title: 'Copied', description: 'QR id copied to clipboard.' });
      } else {
        throw new Error('Fallback copy failed');
      }
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

  // SVG/PNG downloads removed from modal UI. Keep helpers to show a helpful message if invoked directly.
  const downloadSVG = () => {
    toast({ title: 'Not supported', description: 'SVG download removed. Use JPG or PDF.', variant: 'destructive' });
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
    toast({ title: 'Not supported', description: 'PNG download removed. Use JPG or PDF.', variant: 'destructive' });
  }; 

  // Build a printable card canvas (name, email, gym stripe, QR image) similar to registration export
  const buildCardCanvas = async (desiredQrPx = 760) : Promise<HTMLCanvasElement | null> => {
    const svgEl = getSvgElement();
    if (!svgEl) return null;

    // Serialize and sanitize QR svg
    let svgData = new XMLSerializer().serializeToString(svgEl);
    svgData = svgData.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
    svgData = svgData.replace(/\s(width|height)="[^"]*"/g, '');
    svgData = svgData.replace(/<svg([^>]*)>/, `<svg$1 width="${desiredQrPx}" height="${desiredQrPx}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" image-rendering="pixelated">`);
    svgData = svgData.replace(/\sstroke="[^"]*"/g, '');
    svgData = svgData.replace(/fill="(?!#ffffff)[^"]*"/g, 'fill="#000000"');
    svgData = svgData.replace(/<rect[^>]*width="100%"[^>]*>/g, '');
    svgData = svgData.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="#ffffff"/>`);

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    return await new Promise<HTMLCanvasElement | null>((resolve) => {
      img.onload = () => {
        // Card dimensions
        const canvasWidth = 1400;
        const canvasHeight = 700;
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Stripe
        const stripeHeight = 90;
        ctx.fillStyle = gym?.brand_color ?? '#2563eb';
        ctx.fillRect(0, 0, canvasWidth, stripeHeight);

        // Gym name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Inter, Arial, sans-serif';
        ctx.fillText(gym?.name ?? 'Gym', 40, 58);

        // Draw QR image
        const qrSize = 380;
        const padding = 60;
        const qrX = canvasWidth - qrSize - padding;
        const qrY = (canvasHeight - qrSize) / 2;

        ctx.imageSmoothingEnabled = false;
        try { (ctx as any).imageSmoothingQuality = 'high'; } catch (e) { /* ignore */ }

        // white rounded box
        const boxX = qrX - 10;
        const boxY = qrY - 10;
        const boxW = qrSize + 20;
        const boxH = qrSize + 20;
        const radius = 18;

        ctx.save();
        ctx.fillStyle = 'rgba(16,24,40,0.04)';
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, radius);
        ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, radius);
        ctx.arcTo(boxX, boxY + boxH, boxX, boxY, radius);
        ctx.arcTo(boxX, boxY, boxX + boxW, boxY, radius);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // white rect
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, radius);
        ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, radius);
        ctx.arcTo(boxX, boxY + boxH, boxX, boxY, radius);
        ctx.arcTo(boxX, boxY, boxX + boxW, boxY, radius);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e6e6e6';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

        // Left-side content
        const leftX = padding;
        let textY = stripeHeight + 70;

        // Name
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 48px Inter, Arial, sans-serif';
        const fullName = `${user?.first_name ?? '-'} ${user?.last_name ?? ''}`.trim();
        wrapText(ctx, fullName, leftX, textY, qrX - leftX - padding, 56);

        // Email
        textY += 90;
        ctx.font = '26px Inter, Arial, sans-serif';
        ctx.fillStyle = '#111111';
        wrapText(ctx, user?.email ?? '', leftX, textY, qrX - leftX - padding, 34);

        // Phone
        textY += 48;
        ctx.font = '20px Inter, Arial, sans-serif';
        ctx.fillStyle = '#111111';
        ctx.fillText(`Phone: ${user?.phone ?? '-'}`, leftX, textY);

        // Gender
        textY += 36;
        ctx.fillText(`Gender: ${user?.gender ?? '-'}`, leftX, textY);

        // Emergency contact
        textY += 36;
        ctx.fillText(`Emergency: ${user?.emergency_name ?? '-'} (${user?.emergency_phone ?? '-'})`, leftX, textY);

        // Decorative subtitle: Registered to
        textY += 60;
        ctx.font = '18px Inter, Arial, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(`Registered to: ${gym?.name ?? ''}`, leftX, textY + 12);

        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  };

  // helper borrowed from registration page for line wrapping
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  const downloadJPG = async () => {
    try {
      console.log('downloadJPG start', { userId, qrId, user });
      toast({ title: 'Preparing download', description: 'Generating image...', });
      const canvas = await buildCardCanvas();
      if (!canvas) { toast({ title: 'Download failed', description: 'Could not build QR card.', variant: 'destructive' }); return; }
      canvas.toBlob((blob) => {
        try {
          if (!blob) { toast({ title: 'Download failed', description: 'Could not generate image blob.', variant: 'destructive' }); return; }
          const sanitizedGym = (gym?.name ?? 'gym').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
          const regName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'user';
          const filename = `${regName}-${sanitizedGym}-ID.jpg`;
          fileSaver.saveAs(blob, filename);
          toast({ title: 'Download ready', description: `Saved ${filename}` });
        } catch (e) {
          console.error('Error saving JPG', e);
          toast({ title: 'Download failed', description: String(e), variant: 'destructive' });
        }
      }, 'image/jpeg', 0.95);
    } catch (e) {
      console.error('downloadJPG error', e);
      toast({ title: 'Download failed', description: String(e), variant: 'destructive' });
    }
  };

  const downloadPDF = async () => {
    try {
      console.log('downloadPDF start', { userId, qrId, user });
      toast({ title: 'Preparing PDF', description: 'Generating PDF...', });
      const canvas = await buildCardCanvas();
      if (!canvas) { toast({ title: 'Download failed', description: 'Could not build QR card.', variant: 'destructive' }); return; }
      const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      const sanitizedGym = (gym?.name ?? 'gym').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      const regName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'user';
      const filename = `${regName}-${sanitizedGym}-ID.pdf`;
      pdf.save(filename);
      toast({ title: 'Download ready', description: `Saved ${filename}` });
    } catch (e) {
      console.error('downloadPDF error', e);
      toast({ title: 'Download failed', description: String(e), variant: 'destructive' });
    }
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
                    <QRCode value={qrValueForRender || ''} size={176} fgColor="#000000" bgColor="#ffffff" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button type="button"
                      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); console.debug('pointerdown downloadJPG', { userId }); }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); console.debug('mousedown downloadJPG', { userId }); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActionStatus('Preparing JPG...'); console.debug('downloadJPG clicked', { userId, user, qrId }); downloadJPG().finally(() => setActionStatus(null)); }}
                      variant="ghost"
                      disabled={!user}
                    >Download .jpg</Button>

                    <Button type="button"
                      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); console.debug('pointerdown downloadPDF', { userId }); }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); console.debug('mousedown downloadPDF', { userId }); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActionStatus('Preparing PDF...'); console.debug('downloadPDF clicked', { userId, user, qrId }); downloadPDF().finally(() => setActionStatus(null)); }}
                      variant="ghost"
                      disabled={!user}
                    >Download .pdf</Button>

                    <Button type="button"
                      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); console.debug('pointerdown copyQr', { userId }); }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); console.debug('mousedown copyQr', { userId }); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActionStatus('Copying QR id...'); console.debug('copyQr clicked', { userId, user, qrId }); copyQrToClipboard(); setTimeout(() => setActionStatus(null), 1200); }}
                      variant="ghost"
                      disabled={!user}
                    >Copy QR id</Button>
                    <div className="mt-2 text-sm text-muted-foreground break-all max-w-xs">QR id: <span className="font-medium">{qrId ?? '-'}</span></div>
                    {actionStatus && <div className="mt-1 text-sm text-muted-foreground">{actionStatus}</div>}
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
