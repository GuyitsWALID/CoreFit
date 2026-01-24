import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, QrCode, Filter, Download, Users, UserCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { usePhysicalScanner } from '@/hooks/usePhysicalScanner';
import { useGym } from '@/contexts/GymContext';
import { DynamicHeader } from '@/components/layout/DynamicHeader';
import { Sidebar } from '@/components/layout/Sidebar';

interface ClientCheckIn {
  id: string;
  checkin_time: string;
  checkin_date: string;
  checkout_time?: string;
  user_id: string;
  gym_id?: string;
  users: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    package_id?: string;
    packages?: {
      name: string;
    };
  };
}

interface StaffCheckIn {
  id: string;
  checkin_time: string;
  checkin_date: string;
  checkout_time?: string;
  staff_id: string;
  gym_id?: string;
  staff: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role_id?: string;
    roles?: {
      name: string;
    };
  };
}

// Allow using BarcodeDetector without TS lib
declare global {
  interface Window {
    BarcodeDetector?: any;
    jsQR?: any;
  }
}

export default function CheckIns() {
  const { toast } = useToast();
  const { gym, loading: gymLoading } = useGym();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [roleFilter, setRoleFilter] = useState('all');
  const [clientCheckIns, setClientCheckIns] = useState<ClientCheckIn[]>([]);
  const [staffCheckIns, setStaffCheckIns] = useState<StaffCheckIn[]>([]);
  const [qrScanActive, setQrScanActive] = useState(false);
  const [qrStatus, setQrStatus] = useState<'idle' | 'scanning' | 'success' | 'error' | 'not_found'>('idle');
  const [manualQr, setManualQr] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clients');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [barcodeDetectorSupported, setBarcodeDetectorSupported] = useState(false);
  const [jsQRLoaded, setJsQRLoaded] = useState(false);
  
  // Add state to prevent duplicate processing
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [lastProcessedQR, setLastProcessedQR] = useState<string>('');
  const lastProcessedTimeRef = useRef<number>(0);
  
  const todayDate = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Dynamic styling based on gym configuration
  const dynamicStyles = useMemo(() => {
    if (!gym) return {
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      accentColor: '#f59e0b',
    };
    
    const primaryColor = gym.brand_color || '#2563eb';
    return {
      primaryColor: primaryColor,
      secondaryColor: primaryColor,
      accentColor: primaryColor,
    };
  }, [gym]);

  // Use the physical scanner hook
  usePhysicalScanner({ onScan: (value) => handleQrResult(value) });

  useEffect(() => {
    if (gym && gym.id !== 'default') {
      fetchCheckIns();
    }
    checkBarcodeDetectorSupport();
    loadJsQR();
  }, [gym]);

  useEffect(() => {
    // Cleanup camera/interval on unmount
    return () => stopQrScan();
  }, []);

  const addDebugInfo = (info: string) => {
    console.log('QR Debug:', info);
    setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  // Determine whether a package's access level allows check-in at the current time
  const checkPackageAccess = (accessLevel?: string) : { allowed: boolean; reason?: string } => {
    if (!accessLevel) return { allowed: true };
    const hour = new Date().getHours(); // local hour of day (0-23)
    switch ((accessLevel || '').toString()) {
      case 'all_hours':
        return { allowed: true };
      case 'peak_hours':
        // default peak: 06:00 - 22:00
        return { allowed: hour >= 6 && hour < 22, reason: 'Peak hours only (06:00–22:00)' };
      case 'off_peak_hours':
        // default off-peak: 22:00 - 06:00
        return { allowed: hour < 6 || hour >= 22, reason: 'Off-peak hours only (22:00–06:00)' };
      default:
        return { allowed: true };
    }
  };

  // Safely insert a client_checkins row but fallback if package columns are missing in DB schema
  const safeInsertClientCheckin = async (payload: Record<string, any>) => {
    try {
      const { error } = await supabase.from('client_checkins').insert([payload]);
      if (!error) return { ok: true };

      // If the error suggests a missing column in the schema, retry without package metadata
      const msg = (error.message || '').toString().toLowerCase();
      if (msg.includes('package_access_level_at_checkin') || msg.includes('package_type_at_checkin') || msg.includes('could not find') || msg.includes('does not exist') || msg.includes('schema cache')) {
        addDebugInfo('client_checkins schema missing package columns, retrying without those fields');
        const { package_type_at_checkin, package_access_level_at_checkin, ...fallback } = payload as any;
        const { error: fallbackError } = await supabase.from('client_checkins').insert([fallback]);
        if (!fallbackError) return { ok: true, fallback: true };
        return { ok: false, error: fallbackError };
      }

      return { ok: false, error };
    } catch (err: any) {
      return { ok: false, error: err };
    }
  };

  const loadJsQR = async () => {
    try {
      // Load jsQR from CDN
      if (!window.jsQR) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        script.onload = ( ) => {
          setJsQRLoaded(true);
          addDebugInfo('jsQR library loaded successfully');
        };
        script.onerror = () => {
          addDebugInfo('Failed to load jsQR library');
        };
        document.head.appendChild(script);
      } else {
        setJsQRLoaded(true);
        addDebugInfo('jsQR library already available');
      }
    } catch (error) {
      addDebugInfo(`jsQR loading error: ${error}`);
    }
  };

  const checkBarcodeDetectorSupport = () => {
    if ('BarcodeDetector' in window) {
      setBarcodeDetectorSupported(true);
      addDebugInfo('BarcodeDetector API is supported');
    } else {
      setBarcodeDetectorSupported(false);
      addDebugInfo('BarcodeDetector API is NOT supported - will use jsQR fallback');
    }
  };

  const fetchCheckIns = async () => {
    if (!gym || gym.id === 'default') return;
    
    setIsLoading(true);
    try {
      // Fetch client check-ins filtered by gym_id
      let clientQuery = supabase
        .from('client_checkins')
        .select(`
          *,
          users!inner (
            id,
            first_name,
            last_name,
            email,
            package_id,
            gym_id,
            packages (
              name
            )
          )
        `)
        .order('checkin_time', { ascending: false });

      // Filter by gym if gym context is available
      if (gym && gym.id !== 'default') {
        clientQuery = clientQuery.eq('users.gym_id', gym.id);
      }

      const { data: clientData, error: clientError } = await clientQuery;

      if (clientError) {
        console.error('Error fetching client check-ins:', clientError);
        toast({
          title: "Error loading client check-ins",
          description: `Could not load client check-ins: ${clientError.message}`,
          variant: "destructive"
        });
      } else {
        setClientCheckIns(clientData || []);
      }

      // Fetch staff check-ins filtered by gym_id
      let staffQuery = supabase
        .from('staff_checkins')
        .select(`
          *,
          staff!inner (
            id,
            first_name,
            last_name,
            email,
            role_id,
            gym_id,
            roles (
              name
            )
          )
        `)
        .order('checkin_time', { ascending: false });

      // Filter by gym if gym context is available
      if (gym && gym.id !== 'default') {
        staffQuery = staffQuery.eq('staff.gym_id', gym.id);
      }

      const { data: staffData, error: staffError } = await staffQuery;

      if (staffError) {
        console.error('Error fetching staff check-ins:', staffError);
        toast({
          title: "Error loading staff check-ins",
          description: `Could not load staff check-ins: ${staffError.message}`,
          variant: "destructive"
        });
      } else {
        setStaffCheckIns(staffData || []);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error loading check-ins",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter client check-ins
  const filteredClientCheckIns = clientCheckIns
    .filter(checkIn => {
      // Date filter
      if (dateFilter === 'today') return checkIn.checkin_date === todayDate;
      if (dateFilter === 'yesterday') return checkIn.checkin_date === yesterdayDate;
      return true; // 'all' filter
    })
    .filter(checkIn => {
      // Search filter
      if (!searchTerm) return true;
      const fullName = `${checkIn.users.first_name} ${checkIn.users.last_name}`;
      return (
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkIn.users.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  // Filter staff check-ins
  const filteredStaffCheckIns = staffCheckIns
    .filter(checkIn => {
      // Date filter
      if (dateFilter === 'today') return checkIn.checkin_date === todayDate;
      if (dateFilter === 'yesterday') return checkIn.checkin_date === yesterdayDate;
      return true; // 'all' filter
    })
    .filter(checkIn => {
      // Role filter
      if (roleFilter !== 'all') {
        const role = checkIn.staff.roles?.name.toLowerCase();
        return role === roleFilter;
      }
      return true;
    })
    .filter(checkIn => {
      // Search filter
      if (!searchTerm) return true;
      const fullName = `${checkIn.staff.first_name} ${checkIn.staff.last_name}`;
      return (
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkIn.staff.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  // Enhanced QR code detection using jsQR library
  const detectQRCodeWithJsQR = (canvas: HTMLCanvasElement): string | null => {
    try {
      if (!window.jsQR) {
        return null;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code) {
        return code.data;
      }
      
      return null;
    } catch (error: any) {
      addDebugInfo(`jsQR detection error: ${error.message}`);
      return null;
    }
  };

  // QR scanning helpers
  useEffect(() => {
    if (!qrScanActive) return;
    const video = videoRef.current;
    const stream = mediaStreamRef.current;
    if (!video || !stream) return;

    addDebugInfo('Setting up video stream');

    // Attach stream to video and ensure inline autoplay
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const onLoaded = () => {
      addDebugInfo(`Video loaded: ${video.videoWidth}x${video.videoHeight}`);
      video.play().catch((err) => {
        addDebugInfo(`Video play error: ${err.message}`);
      });
    };
    
    const onError = (err: any) => {
      addDebugInfo(`Video error: ${err.message || err}`);
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);

    const startDetect = () => {
      addDebugInfo('Starting QR detection');
      
      // Prepare detector and canvas
      if (barcodeDetectorSupported && !detectorRef.current) {
        try {
          detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
          addDebugInfo('BarcodeDetector initialized');
        } catch (err: any) {
          addDebugInfo(`BarcodeDetector init error: ${err.message}`);
        }
      }
      
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        addDebugInfo('Canvas created');
      }

      // Poll frames with duplicate prevention
      scanTimerRef.current = window.setInterval(async () => {
        try {
          // Skip if already processing a QR code
          if (isProcessingQR) {
            return;
          }

          if (!videoRef.current || !canvasRef.current) return;

          const vw = videoRef.current.videoWidth;
          const vh = videoRef.current.videoHeight;
          if (!vw || !vh) return; // wait until video has dimensions

          // Draw the current frame to an offscreen canvas at native resolution
          const canvas = canvasRef.current;
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
            addDebugInfo(`Canvas resized to ${vw}x${vh}`);
          }
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(videoRef.current, 0, 0, vw, vh);

          let detectedValue: string | null = null;

          // Try BarcodeDetector first
          if (detectorRef.current) {
            try {
              const barcodes = await detectorRef.current.detect(canvas);
              if (barcodes && barcodes.length > 0) {
                detectedValue = barcodes[0].rawValue || '';
              }
            } catch (detectError: any) {
              // Silent fail for detection errors
            }
          }

          // Try jsQR fallback if BarcodeDetector failed or not available
          if (!detectedValue && jsQRLoaded) {
            detectedValue = detectQRCodeWithJsQR(canvas);
          }

          // Additional processing attempts with different image processing
          if (!detectedValue && jsQRLoaded && window.jsQR) {
            try {
              // Try with inverted colors
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
              });
              
              if (code) {
                detectedValue = code.data;
              }
            } catch (inversionError: any) {
              // Silent fail for inversion attempts
            }
          }

          if (detectedValue && detectedValue.trim()) {
            const currentTime = Date.now();
            const trimmedValue = detectedValue.trim();
            
            // Prevent duplicate processing of the same QR code within 3 seconds
            if (trimmedValue === lastProcessedQR && (currentTime - lastProcessedTimeRef.current) < 3000) {
              addDebugInfo('Duplicate QR code detected, skipping');
              return;
            }

            // Set processing flag to prevent multiple simultaneous processing
            setIsProcessingQR(true);
            setLastProcessedQR(trimmedValue);
            lastProcessedTimeRef.current = currentTime;
            
            addDebugInfo(`QR Code detected: ${trimmedValue.substring(0, 100)}`);
            
            try {
              await handleQrResult(trimmedValue);
            } finally {
              // Always reset processing flag after handling
              setTimeout(() => {
                setIsProcessingQR(false);
              }, 1000); // 1 second cooldown
            }
            
            stopQrScan();
          }
        } catch (frameError: any) {
          addDebugInfo(`Frame processing error: ${frameError.message}`);
        }
      }, 100); // 100ms intervals
    };

    // Start when mounted
    const rAF = requestAnimationFrame(startDetect);

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
      cancelAnimationFrame(rAF);
    };
  }, [qrScanActive, barcodeDetectorSupported, jsQRLoaded, isProcessingQR, lastProcessedQR]);

  const stopQrScan = () => {
    addDebugInfo('Stopping QR scan');
    setQrScanActive(false);
    setIsProcessingQR(false);
    setLastProcessedQR('');
    lastProcessedTimeRef.current = 0;
    
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
    canvasRef.current = null;
    setQrStatus('idle');
  };

  // Helper: get camera stream with fallbacks and higher ideal resolution
  const getCameraStream = async (): Promise<MediaStream> => {
    addDebugInfo('Requesting camera access');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false,
      });
      addDebugInfo('Camera access granted (environment)');
      return stream;
    } catch (envError) {
      addDebugInfo(`Environment camera failed: ${envError}`);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1920, min: 640 }, 
            height: { ideal: 1080, min: 480 },
            frameRate: { ideal: 30, min: 15 }
          },
          audio: false,
        });
        addDebugInfo('Camera access granted (any)');
        return stream;
      } catch (anyError) {
        addDebugInfo(`Any camera failed: ${anyError}`);
        throw anyError;
      }
    }
  };

  const startQrScan = async () => {
    try {
      setQrStatus('scanning');
      setDebugInfo([]);
      setIsProcessingQR(false);
      setLastProcessedQR('');
      lastProcessedTimeRef.current = 0;
      
      addDebugInfo('Starting QR scan process');
      addDebugInfo(`Detection methods available: BarcodeDetector=${barcodeDetectorSupported}, jsQR=${jsQRLoaded}`);
      
      const stream = await getCameraStream();
      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('No video tracks available');
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      addDebugInfo(`Video track: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
      
      mediaStreamRef.current = stream;
      setQrScanActive(true);
    } catch (e: any) {
      addDebugInfo(`Camera error: ${e.message}`);
      setQrStatus('error');
      toast({
        title: 'Camera error',
        description: e?.message || 'Could not access the camera. Please check permissions and try again.',
        variant: 'destructive',
      });
    }
  };

  // Prevent duplicate DB inserts within a short window
  const DEDUP_WINDOW_SEC = 60;
  const alreadyCheckedInRecently = async (type: 'user' | 'staff', id: string, seconds = DEDUP_WINDOW_SEC) => {
    const sinceISO = new Date(Date.now() - seconds * 1000).toISOString();
    const table = type === 'user' ? 'client_checkins' : 'staff_checkins';
    const idCol = type === 'user' ? 'user_id' : 'staff_id';
    
    let query = supabase
      .from(table)
      .select('id')
      .eq(idCol, id)
      .gte('checkin_time', sinceISO)
      .limit(1);

    // Filter by gym context if available
    if (gym && gym.id !== 'default') {
      if (type === 'user') {
        // For users, check via users table gym_id
        query = query.eq('users.gym_id', gym.id);
      } else {
        // For staff, check via staff table gym_id
        query = query.eq('staff.gym_id', gym.id);
      }
    }

    const { data, error } = await query;

    if (error) {
      // If error happens, don't block; just log
      addDebugInfo(`dedupe check error (${type}): ${error.message}`);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  };

  const [scanLocked, setScanLocked] = useState(false);
  const scanLockTimerRef = useRef<number | null>(null);

  const handleQrResult = async (value: string) => {
    if (scanLocked) {
      addDebugInfo('Scan ignored: scanLocked is active');
      return;
    }

    // Immediately lock to prevent concurrent/duplicate handling
    setScanLocked(true);

    let scanSucceeded = false;

    try {
      const code = value.trim();
      const nowIso = new Date().toISOString();
      const dateStr = nowIso.split('T')[0];

      addDebugInfo(`Processing QR code: ${code.substring(0, 50)}...`);

      // First, try to parse as JSON (new format from registration)
      let qrData: any = null;
      try {
        qrData = JSON.parse(code);
        addDebugInfo(`Parsed as JSON: ${JSON.stringify(qrData).substring(0, 100)}`);
      } catch (parseError) {
        addDebugInfo('QR code is not JSON, trying other methods');
      }

      // Handle new JSON format from registration for users OR staff
      if (qrData && (qrData.userId || qrData.staffId)) {
        if (qrData.userId) {
          // Check if gym matches
          if (gym && gym.id !== 'default' && qrData.gymId && qrData.gymId !== gym.id) {
            addDebugInfo(`Gym ID mismatch: QR has ${qrData.gymId}, current gym is ${gym.id}`);
            toast({
              title: 'Wrong gym',
              description: 'This QR code is for a different gym location.',
              variant: 'destructive',
            });
            setQrStatus('error');
            return;
          }

          // Look up user by ID
          let userQuery = supabase
            .from('users')
            .select('id, first_name, last_name, email, package_id, gym_id, packages(name)')
            .eq('id', qrData.userId);

          // Filter by gym if available
          if (gym && gym.id !== 'default') {
            userQuery = userQuery.eq('gym_id', gym.id);
          }

          const { data: userMatch, error: userErr } = await userQuery.maybeSingle();

          if (userErr) {
            addDebugInfo(`User lookup error: ${userErr.message}`);
            throw new Error(`Database error: ${userErr.message}`);
          }

          if (userMatch) {
            // Dedupe guard
            if (await alreadyCheckedInRecently('user', userMatch.id)) {
              addDebugInfo('Duplicate user check-in prevented by time window');
              toast({
                title: 'Already checked in',
                description: `${userMatch.first_name} ${userMatch.last_name} just checked in. Try again later.`,
              });
              setQrStatus('success');
              return;
            }

            addDebugInfo(`Found user: ${userMatch.first_name} ${userMatch.last_name}`);

            // Resolve package name & access level (try relation first, else lookup by package_id)
            let packageName: string | null = null;
            let packageAccessLevel: string | null = null;
            if (userMatch.packages) {
              const pkg = Array.isArray(userMatch.packages) ? userMatch.packages[0] : userMatch.packages;
              packageName = pkg?.name || null;
              packageAccessLevel = pkg?.access_level || (pkg as any)?.accessLevel || null;
            } else if (userMatch.package_id) {
              const { data: pkgRow } = await supabase.from('packages').select('name, access_level').eq('id', userMatch.package_id).maybeSingle();
              packageName = (pkgRow as any)?.name || null;
              packageAccessLevel = (pkgRow as any)?.access_level || (pkgRow as any)?.accessLevel || null;
            }

            // Enforce package access rules
            const { allowed, reason } = checkPackageAccess(packageAccessLevel);
            if (!allowed) {
              addDebugInfo(`Access denied by package (${packageAccessLevel || 'unknown'}): ${reason}`);
              toast({ title: 'Access denied', description: `Access denied: your package allows ${reason}.`, variant: 'destructive' });
              setQrStatus('error');
              return;
            }

            // Insert into client_checkins with gym_id and package metadata
            const checkInData = {
              user_id: userMatch.id,
              checkin_time: nowIso,
              checkin_date: dateStr,
              gym_id: gym?.id || null,
              package_type_at_checkin: packageName,
              package_access_level_at_checkin: packageAccessLevel || null,
            };

            const insertResult = await safeInsertClientCheckin(checkInData);
            if (!insertResult.ok) {
              const errMsg = insertResult.error?.message || JSON.stringify(insertResult.error);
              throw new Error(`Failed to record check-in: ${errMsg}`);
            }
            if (insertResult.fallback) addDebugInfo('Check-in inserted without package metadata (DB lacks columns)');

            scanSucceeded = true; // mark success so cooldown applies
            setQrStatus('success');
            toast({
              title: 'Check-in successful',
              description: `${userMatch.first_name} ${userMatch.last_name} has been checked in successfully to ${gym?.name || 'the gym'}.`,
            });
            fetchCheckIns();
            return; 
          } else {
            addDebugInfo(`User not found with ID: ${qrData.userId} in gym ${gym?.id}`);
          }
        } else if (qrData.staffId) {
          // Check if gym matches for staff
          if (gym && gym.id !== 'default' && qrData.gymId && qrData.gymId !== gym.id) {
            addDebugInfo(`Gym ID mismatch for staff: QR has ${qrData.gymId}, current gym is ${gym.id}`);
            toast({
              title: 'Wrong gym',
              description: 'This staff QR code is for a different gym location.',
              variant: 'destructive',
            });
            setQrStatus('error');
            return;
          }

          let staffQuery = supabase
            .from('staff')
            .select('id, first_name, last_name, email, role_id, gym_id, roles(name)')
            .eq('id', qrData.staffId);

          // Filter by gym if available
          if (gym && gym.id !== 'default') {
            staffQuery = staffQuery.eq('gym_id', gym.id);
          }

          const { data: staffMatch, error: staffErr } = await staffQuery.maybeSingle();

          if (staffErr) {
            addDebugInfo(`Staff lookup error: ${staffErr.message}`);
            throw new Error(`Database error: ${staffErr.message}`);
          }

          if (staffMatch) {
            // Dedupe guard
            if (await alreadyCheckedInRecently('staff', staffMatch.id)) {
              addDebugInfo('Duplicate staff check-in prevented by time window');
              toast({
                title: 'Already checked in',
                description: `${staffMatch.first_name} ${staffMatch.last_name} just checked in. Try again later.`,
              });
              setQrStatus('success');
              return;
            }

            addDebugInfo(`Found staff: ${staffMatch.first_name} ${staffMatch.last_name}`);

            const { error: staffInsertError } = await supabase
              .from('staff_checkins')
              .insert([{
                staff_id: staffMatch.id,
                checkin_time: nowIso,
                checkin_date: dateStr,
                gym_id: gym?.id || null,
              }]);

            if (staffInsertError) {
              throw new Error(`Failed to record staff check-in: ${staffInsertError.message}`);
            }

            scanSucceeded = true;
            setQrStatus('success');
            toast({
              title: 'Check-in successful',
              description: `${staffMatch.first_name} ${staffMatch.last_name} has been checked in successfully to ${gym?.name || 'the gym'}.`,
            });
            fetchCheckIns();
            return;
          } else {
            addDebugInfo(`Staff not found with ID: ${qrData.staffId} in gym ${gym?.id}`);
          }
        }
      }

      // Fallback: Try to match by qr_code_data field in users table
      const { data: userByQrCode, error: qrCodeErr } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, package_id, packages(name), qr_code_data')
        .eq('gym_id', gym?.id)
        .eq('qr_code_data', code)
        .maybeSingle();

      if (qrCodeErr) {
        addDebugInfo(`qr_code_data lookup error: ${qrCodeErr.message}`);
      }

      if (userByQrCode) {
        // Dedupe guard
        if (await alreadyCheckedInRecently('user', userByQrCode.id)) {
          addDebugInfo('Duplicate user check-in prevented by time window (qr_code_data path)');
          toast({
            title: 'Already checked in',
            description: `${userByQrCode.first_name} ${userByQrCode.last_name} just checked in. Try again later.`,
          });
          setQrStatus('success');
          return;
        }

        const checkInData = {
          user_id: userByQrCode.id,
          checkin_time: nowIso,
          checkin_date: dateStr,
        };

        const packageInfo = userByQrCode.packages as any;
        const packageName = Array.isArray(packageInfo) ? packageInfo[0]?.name || null : packageInfo?.name || null;
        const packageAccessLevel = Array.isArray(packageInfo) ? packageInfo[0]?.access_level || packageInfo[0]?.accessLevel || null : packageInfo?.access_level || packageInfo?.accessLevel || null;

        // Enforce package access rules
        const { allowed, reason } = checkPackageAccess(packageAccessLevel);
        if (!allowed) {
          addDebugInfo(`Access denied by package (${packageAccessLevel || 'unknown'}): ${reason}`);
          toast({ title: 'Access denied', description: `Access denied: your package allows ${reason}.`, variant: 'destructive' });
          setQrStatus('error');
          return;
        }

        const extendedCheckInData = {
          ...checkInData,
          'QR-CODE USED': true,
          package_type_at_checkin: packageName,
          package_access_level_at_checkin: packageAccessLevel || null,
        };

        const insertResult = await safeInsertClientCheckin(extendedCheckInData);
        if (!insertResult.ok) {
          throw new Error(`Failed to record check-in: ${insertResult.error?.message || JSON.stringify(insertResult.error)}`);
        }
        if (insertResult.fallback) addDebugInfo('Check-in inserted without package metadata (DB lacks columns)');

        scanSucceeded = true;
        setQrStatus('success');
        toast({
          title: 'Check-in successful',
          description: `${userByQrCode.first_name} ${userByQrCode.last_name} has been checked in successfully to ${gym?.name || 'the gym'}.`,
        });
        fetchCheckIns();
        return;
      }

      // Try staff qr_code lookup (use staff.qr_code)
      const { data: staffByQrCode, error: staffQrErr } = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, role_id, roles(name), qr_code')
        .eq('gym_id', gym?.id)
        .eq('qr_code', code)
        .maybeSingle();

      if (staffQrErr) {
        addDebugInfo(`staff qr_code lookup error: ${staffQrErr.message}`);
      }

      if (staffByQrCode) {
        // Dedupe guard
        if (await alreadyCheckedInRecently('staff', staffByQrCode.id)) {
          addDebugInfo('Duplicate staff check-in prevented by time window (qr_code path)');
          toast({
            title: 'Already checked in',
            description: `${staffByQrCode.first_name} ${staffByQrCode.last_name} just checked in. Try again later.`,
          });
          setQrStatus('success');
          return;
        }

        const { error: staffInsertError } = await supabase
          .from('staff_checkins')
          .insert([{
            staff_id: staffByQrCode.id,
            checkin_time: nowIso,
            checkin_date: dateStr,
          }]);
        if (staffInsertError) {
          throw new Error(`Failed to record staff check-in: ${staffInsertError.message}`);
        }

        setQrStatus('success');
        toast({
          title: 'Check-in successful',
          description: `${staffByQrCode.first_name} ${staffByQrCode.last_name} has been checked in successfully to ${gym?.name || 'the gym'}.`,
        });
        fetchCheckIns();
        return;
      }

      // Legacy fallback: extract ID and try user/staff by ID
      const extractIdFromPayload = (payload: string): { id: string; kind: 'user' | 'staff' | 'unknown' } => {
        try {
          const obj = JSON.parse(payload);
          if (obj.userId) return { id: obj.userId, kind: 'user' };
          if (obj.user_id) return { id: obj.user_id, kind: 'user' };
          if (obj.staffId) return { id: obj.staffId, kind: 'staff' }; // accept camelCase
          if (obj.staff_id) return { id: obj.staff_id, kind: 'staff' };
          if (obj.id && obj.type) return { id: obj.id, kind: obj.type === 'staff' ? 'staff' : 'user' };
        } catch {}
        
        // Check if it's a UUID
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
        if (uuidRegex.test(payload)) return { id: payload, kind: 'unknown' };
        
        return { id: '', kind: 'unknown' };
      };

      const { id, kind } = extractIdFromPayload(code);
      if (!id) {
        addDebugInfo('No valid ID found in QR code');
        setQrStatus('not_found');
        toast({
          title: 'QR code not recognized',
          description: 'The scanned QR code did not match any user or staff member.',
          variant: 'destructive',
        });
        return;
      }

      addDebugInfo(`Extracted ID: ${id}, Kind: ${kind}`);

      let isUser = false;
      let person: any = null;

      if (kind !== 'staff') {
        const { data: userById } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, package_id, packages(name)')
          .eq('gym_id', gym?.id)
          .eq('id', id)
          .maybeSingle();
        
        if (userById) {
          person = userById;
          isUser = true;
          addDebugInfo(`Found user by ID: ${person.first_name} ${person.last_name}`);
        }
      }

      if (!person) {
        const { data: staffById } = await supabase
          .from('staff')
          .select('id, first_name, last_name, email, role_id, roles(name)')
          .eq('gym_id', gym?.id)
          .eq('id', id)
          .maybeSingle();
        
        if (staffById) {
          person = staffById;
          isUser = false;
          addDebugInfo(`Found staff by ID: ${person.first_name} ${person.last_name}`);
        }
      }

      if (!person) {
        addDebugInfo('Person not found in database');
        setQrStatus('not_found');
        toast({
          title: 'QR code not recognized',
          description: 'The scanned QR code did not match any user or staff member.',
          variant: 'destructive',
        });
        return;
      }

      // Final insert with dedupe guard
      if (isUser) {
        if (await alreadyCheckedInRecently('user', person.id)) {
          addDebugInfo('Duplicate user check-in prevented by time window (fallback path)');
          toast({
            title: 'Already checked in',
            description: `${person.first_name} ${person.last_name} just checked in. Try again later.`,
          });
          setQrStatus('success');
          return;
        }

        const checkInData = {
          user_id: person.id,
          checkin_time: nowIso,
          checkin_date: dateStr,
        };

        // Resolve package access level if available
        let packageAccessLevel: string | null = null;
        if (person.package_id) {
          const { data: pkgRow } = await supabase.from('packages').select('access_level, name').eq('id', person.package_id).maybeSingle();
          packageAccessLevel = (pkgRow as any)?.access_level || (pkgRow as any)?.accessLevel || null;
        } else if (person.packages) {
          const pkg = Array.isArray(person.packages) ? person.packages[0] : person.packages;
          packageAccessLevel = pkg?.access_level || pkg?.accessLevel || null;
        }

        const { allowed, reason } = checkPackageAccess(packageAccessLevel);
        if (!allowed) {
          addDebugInfo(`Access denied by package (${packageAccessLevel || 'unknown'}): ${reason}`);
          toast({ title: 'Access denied', description: `Access denied: your package allows ${reason}.`, variant: 'destructive' });
          setQrStatus('error');
          return;
        }

        const extendedCheckInData = {
          ...checkInData,
          'QR-CODE USED': true,
          package_type_at_checkin: person.packages?.name || null,
          package_access_level_at_checkin: packageAccessLevel || null,
        };

        const insertResult = await safeInsertClientCheckin(extendedCheckInData);
        if (!insertResult.ok) {
          throw new Error(`Failed to record check-in: ${insertResult.error?.message || JSON.stringify(insertResult.error)}`);
        }
        if (insertResult.fallback) addDebugInfo('Check-in inserted without package metadata (DB lacks columns)');
      } else {
        if (await alreadyCheckedInRecently('staff', person.id)) {
          addDebugInfo('Duplicate staff check-in prevented by time window (fallback path)');
          toast({
            title: 'Already checked in',
            description: `${person.first_name} ${person.last_name} just checked in. Try again later.`,
          });
          setQrStatus('success');
          return;
        }

        const { error: staffInsertError } = await supabase
          .from('staff_checkins')
          .insert([{ staff_id: person.id, checkin_time: nowIso, checkin_date: dateStr }]);
        if (staffInsertError) throw new Error(`Failed to record staff check-in: ${staffInsertError.message}`);
      }

      setQrStatus('success');
      toast({
        title: 'Check-in successful',
        description: `${person.first_name} ${person.last_name} has been checked in successfully to ${gym?.name || 'the gym'}.`,
      });
      fetchCheckIns();

    } catch (err: any) {
      addDebugInfo(`QR handling error: ${err.message}`);
      setQrStatus('error');
      toast({
        title: 'Check-in error',
        description: `An error occurred while recording the check-in: ${err.message}`,
        variant: 'destructive',
      });
    } finally {
      // If scan succeeded, keep lock for cooldown to avoid duplicate inserts
      if (scanSucceeded) {
        if (scanLockTimerRef.current) window.clearTimeout(scanLockTimerRef.current);
        scanLockTimerRef.current = window.setTimeout(() => {
          setScanLocked(false);
          scanLockTimerRef.current = null;
          addDebugInfo('Scan lock released after cooldown');
        }, 5000);
      } else {
        // release lock immediately if not successful so retries are possible
        setScanLocked(false);
      }
    }
  };

  const handleManualQr = async () => {
    if (!manualQr.trim()) {
      toast({
        title: 'Invalid input',
        description: 'Please enter a QR code value.',
        variant: 'destructive',
      });
      return;
    }
    
    // Prevent duplicate manual processing
    if (isProcessingQR) {
      toast({
        title: 'Processing in progress',
        description: 'Please wait for the current check-in to complete.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessingQR(true);
    try {
      await handleQrResult(manualQr.trim());
    } finally {
      setTimeout(() => {
        setIsProcessingQR(false);
      }, 1000);
    }
  };

  // Loading state
  if (gymLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gym || gym.id === 'default') {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DynamicHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <h2 className="text-xl font-semibold mb-2">Gym Context Required</h2>
                <p className="text-gray-600 mb-4">
                  This page requires a specific gym context. Please access it from a gym-specific URL.
                </p>
                <Button onClick={() => window.location.href = '/admin/dashboard'}>
                  Go to Admin Dashboard
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DynamicHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
              <div>
                <h2 
                  className="text-3xl font-bold tracking-tight"
                  style={{ color: dynamicStyles.primaryColor }}
                >
                  Check-ins for {gym.name}
                </h2>
                <p className="text-gray-500 mt-1">
                  Manage QR code scanning and view check-in history
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={fetchCheckIns}>Refresh</Button>
              </div>
            </div>

            <Card style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
              <CardHeader>
                <CardTitle 
                  className="flex items-center gap-2"
                  style={{ color: dynamicStyles.primaryColor }}
                >
                  <QrCode className="h-5 w-5" />
                  QR Code Scanner
                  <div className="flex gap-1">
                    {barcodeDetectorSupported && (
                      <Badge variant="outline" className="text-xs">BarcodeDetector</Badge>
                    )}
                    {jsQRLoaded && (
                      <Badge variant="outline" className="text-xs">jsQR</Badge>
                    )}
                    {isProcessingQR && (
                      <Badge variant="destructive" className="text-xs">Processing...</Badge>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  Scan QR codes to check in clients and staff members to {gym.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!qrScanActive ? (
                    <div className="flex gap-4">
                      <Button 
                        onClick={startQrScan} 
                        className="flex items-center gap-2 text-white"
                        disabled={isProcessingQR}
                        style={{ backgroundColor: dynamicStyles.primaryColor }}
                      >
                        <QrCode className="h-4 w-4" />
                        Start Camera Scan
                      </Button>
                      <div className="flex gap-2 flex-1">
                        <Input
                          placeholder="Or enter QR code manually..."
                          value={manualQr}
                          onChange={(e) => setManualQr(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleManualQr()}
                          disabled={isProcessingQR}
                        />
                        <Button 
                          onClick={handleManualQr} 
                          variant="outline"
                          disabled={isProcessingQR}
                          style={{ borderColor: dynamicStyles.primaryColor, color: dynamicStyles.primaryColor }}
                        >
                          {isProcessingQR ? 'Processing...' : 'Submit'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative bg-black rounded-lg overflow-hidden">
                        <video
                          ref={videoRef}
                          className="w-full h-64 object-cover"
                          playsInline
                          muted
                          autoPlay
                        />
                        <div className="absolute inset-0 border-2 border-white/50 rounded-lg pointer-events-none">
                          <div 
                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 rounded-lg"
                            style={{ borderColor: dynamicStyles.primaryColor }}
                          ></div>
                        </div>
                        {isProcessingQR && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="bg-white p-4 rounded-lg flex items-center gap-2">
                              <div 
                                className="animate-spin rounded-full h-4 w-4 border-b-2"
                                style={{ borderColor: dynamicStyles.primaryColor }}
                              ></div>
                              <span className="text-sm">Processing QR code...</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={stopQrScan} variant="outline" disabled={isProcessingQR}>
                          Stop Scanning
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {qrStatus === 'scanning' && !isProcessingQR && (
                            <>
                              <div 
                                className="animate-spin rounded-full h-4 w-4 border-b-2"
                                style={{ borderColor: dynamicStyles.primaryColor }}
                              ></div>
                              Scanning for QR codes...
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Debug Information */}
                      {debugInfo.length > 0 && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <h4 className="text-sm font-medium mb-2">Debug Info:</h4>
                          <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                            {debugInfo.map((info, index) => (
                              <div key={index} className="text-gray-600">{info}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {qrStatus === 'success' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
                      ✓ Check-in recorded successfully for {gym.name}!
                    </div>
                  )}
                  
                  {qrStatus === 'error' && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                      ✗ Error processing QR code. Please try again.
                    </div>
                  )}
                  
                  {qrStatus === 'not_found' && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                      ⚠ QR code not recognized for {gym.name}. Please check the code and try again.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tabs with dynamic styling */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger 
                  value="clients"
                  style={activeTab === 'clients' ? { backgroundColor: dynamicStyles.primaryColor, color: 'white' } : {}}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Clients
                </TabsTrigger>
                <TabsTrigger 
                  value="staff"
                  style={activeTab === 'staff' ? { backgroundColor: dynamicStyles.primaryColor, color: 'white' } : {}}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Staff
                </TabsTrigger>
              </TabsList>
              
              {/* Client Tab */}
              <TabsContent value="clients">
                <Card style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
                  <CardHeader>
                    <CardTitle style={{ color: dynamicStyles.primaryColor }}>
                      Client Check-ins
                    </CardTitle>
                    <CardDescription>
                      Client check-in history for {gym.name}
                    </CardDescription>
                    <div className="flex items-center gap-2 pt-4">
                      <div className="relative w-full">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name or email..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                      <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by date" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline"
                        style={{ borderColor: dynamicStyles.primaryColor, color: dynamicStyles.primaryColor }}
                      >
                        <Download className="mr-2 h-4 w-4" /> Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Check-in Time</TableHead>
                          <TableHead>Check-out Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                        ) : filteredClientCheckIns.length > 0 ? (
                          filteredClientCheckIns.map(checkIn => (
                            <TableRow key={checkIn.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar>
                                    <AvatarImage />
                                    <AvatarFallback>{`${checkIn.users.first_name[0]}${checkIn.users.last_name[0]}`}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{`${checkIn.users.first_name} ${checkIn.users.last_name}`}</p>
                                    <p className="text-sm text-muted-foreground">{checkIn.users.email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  style={{ backgroundColor: `${dynamicStyles.primaryColor}20`, color: dynamicStyles.primaryColor }}
                                >
                                  {checkIn.users.packages?.name || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(checkIn.checkin_time).toLocaleTimeString()}</TableCell>
                              <TableCell>{checkIn.checkout_time ? new Date(checkIn.checkout_time).toLocaleTimeString() : 'N/A'}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              No client check-ins found for {gym.name}.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Staff Tab */}
              <TabsContent value="staff">
                <Card style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
                  <CardHeader>
                    <CardTitle style={{ color: dynamicStyles.primaryColor }}>
                      Staff Check-ins
                    </CardTitle>
                    <CardDescription>
                      Staff check-in history for {gym.name}
                    </CardDescription>
                    <div className="flex items-center gap-2 pt-4">
                      <div className="relative w-full">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name or email..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline"
                        style={{ borderColor: dynamicStyles.primaryColor, color: dynamicStyles.primaryColor }}
                      >
                        <Download className="mr-2 h-4 w-4" /> Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Check-in Time</TableHead>
                          <TableHead>Check-out Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                        ) : filteredStaffCheckIns.length > 0 ? (
                          filteredStaffCheckIns.map(checkIn => (
                            <TableRow key={checkIn.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar>
                                    <AvatarImage />
                                    <AvatarFallback>{`${checkIn.staff.first_name[0]}${checkIn.staff.last_name[0]}`}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{`${checkIn.staff.first_name} ${checkIn.staff.last_name}`}</p>
                                    <p className="text-sm text-muted-foreground">{checkIn.staff.email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  style={{ backgroundColor: `${dynamicStyles.accentColor}20`, color: dynamicStyles.accentColor }}
                                >
                                  {checkIn.staff.roles?.name || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(checkIn.checkin_time).toLocaleTimeString()}</TableCell>
                              <TableCell>{checkIn.checkout_time ? new Date(checkIn.checkout_time).toLocaleTimeString() : 'N/A'}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              No staff check-ins found for {gym.name}.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
