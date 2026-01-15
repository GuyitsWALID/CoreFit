import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

interface PreviewResult {
  usersInserted?: number;
  staffInserted?: number;
  skippedPayments?: number;
  skippedRows?: any[];
  warnings?: string[];
  detectedTables?: string[];
}

export const MigrationDashboard: React.FC = () => {
  const [gyms, setGyms] = useState<{ id: string; name: string }[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [env, setEnv] = useState<string>(import.meta.env.MODE || 'development');
  const logEndRef = useRef<HTMLDivElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchGyms = async () => {
      const { data } = await supabase.from('gyms').select('id, name').eq('status', 'active').order('name');
      if (data) {
        setGyms(data as { id: string; name: string }[]);
        if (data.length > 0) setSelectedGymId(data[0].id);
      }
    };
    fetchGyms();
  }, []);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }]);
    // Scroll terminal to bottom
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      addLog(`File selected: ${e.target.files[0].name}`, 'info');

      // Auto-run preview on file selection
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        try {
          addLog('Parsing file (preview)...', 'info');
          const res = await fetch('/functions/v1/migrate-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql: content, gymId: selectedGymId })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Preview failed' }));
            addLog(`Preview error: ${err.error || 'Unknown'}`, 'error');
            return;
          }
          const { preview } = await res.json();
          setPreview(preview);
          addLog(`Preview complete. Detected tables: ${preview.detectedTables?.join(', ') || 'none'}`, 'success');
          if (preview.warnings && preview.warnings.length) {
            preview.warnings.forEach((w: string) => addLog(`Warning: ${w}`, 'warning'));
          }
        } catch (err: any) {
          addLog(`Preview failed: ${err.message}`, 'error');
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };

  // CSV export for skipped rows
  const downloadSkippedCSV = () => {
    if (!preview?.skippedRows || preview.skippedRows.length === 0) return;
    const rows = preview.skippedRows;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(',')].concat(rows.map((r: any) => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skipped_rows.csv';
    a.click();
  };

  const runMigration = async () => {
    if (!file || !selectedGymId) return;
    if (!isDryRun) {
      // Safety lock: simple prompt
      const confirm = window.prompt('Type MIGRATE to confirm final migration');
      if (confirm !== 'MIGRATE') {
        addLog('Migration cancelled by user (confirmation failed).', 'warning');
        return;
      }
    }

    setIsMigrating(true);
    setProgress(0);
    setLogs([]);

    const content = await file.text();

    try {
      const res = await fetch('/functions/v1/migrate-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: content, gymId: selectedGymId, dryRun: isDryRun })
      });

      if (!res.body) throw new Error('Streaming not supported by this browser');

      addLog(`Server response status: ${res.status}`, 'info');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let receivedEvents = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSE chunks are separated by "\n\n"
        let parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;

          // Handle multiple data: lines in a part
          const dataLines = trimmed.split(/\r?\n/).filter(l => l.startsWith('data:'));
          if (dataLines.length === 0) {
            addLog(`Non-data chunk received: ${trimmed.slice(0, 200)}`, 'warning');
            continue;
          }

          for (const line of dataLines) {
            const dataStr = line.replace(/^data:\s*/m, '');
            let obj: any = null;
            try { obj = JSON.parse(dataStr); } catch (e) { addLog(`Malformed event: ${dataStr}`, 'warning'); continue; }

            receivedEvents++;

            if (obj.type === 'progress') {
              setProgress(obj.percent ?? 0);
              addLog(`Progress: ${obj.percent}%`, 'info');
            } else if (obj.type === 'start') {
              addLog(obj.message || 'Migration started', 'info');
            } else if (obj.type === 'done') {
              addLog('Migration finished', 'success');
              if (obj.result?.skippedPayments) addLog(`Skipped payments: ${obj.result.skippedPayments}`, 'warning');
              if (obj.result?.skippedRows && obj.result.skippedRows.length) addLog(`Skipped rows: ${obj.result.skippedRows.length}`, 'warning');
              // if preview was included in result
              if (obj.result?.preview) setPreview(obj.result.preview);
            } else if (obj.type === 'error') {
              addLog(`Error: ${obj.message}`, 'error');
            } else {
              addLog(`Event: ${JSON.stringify(obj).slice(0, 400)}`, 'info');
            }
          }
        }
      }

      if (receivedEvents === 0) {
        addLog('Migration stream closed without emitting events. Check function logs and preview output.', 'warning');
      } else {
        addLog('Migration stream closed', 'info');
      }

    } catch (err: any) {
      addLog(`Migration failed: ${err.message}`, 'error');
    } finally {
      setIsMigrating(false);
      setProgress(100);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-20 bg-gradient-to-r from-blue-600 to-blue-400 shadow-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Migration Dashboard</h1>
              <span className="text-sm text-blue-100">Admin Tool for Gym Data Migration</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <span className="bg-white/20 text-white px-3 py-1 rounded text-xs font-medium">v1.0</span>
            <span className="bg-green-500/80 text-white px-3 py-1 rounded text-xs font-medium">Production</span>
          </div>
        </header>
        {isMobile && (
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <button
              className="btn-ghost"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="font-semibold text-lg text-blue-600">Super Admin</h1>
          </div>
        )}

        <div className="p-6 max-w-4xl mx-auto w-full bg-white shadow-xl rounded-xl border border-gray-200">
          <div className="mb-8 border-b pb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gym Data Migration Tool</h1>
              <p className="text-gray-500">Active Gym: <strong>{selectedGymId ? gyms.find(g => g.id === selectedGymId)?.name : 'None selected'}</strong> <code className="bg-gray-100 px-2 rounded">{selectedGymId}</code></p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-gray-100 text-sm">Env: {env}</span>
              <span className="px-2 py-1 rounded bg-green-50 text-green-700 text-sm">Connection: {gyms.length > 0 ? 'OK' : 'Unknown'}</span>
            </div>
          </div>

          {/* Select Gym */}
          <div className="mb-6">
            <label className="block font-semibold text-gray-700 mb-2">Select Target Gym</label>
            <select value={selectedGymId ?? ''} onChange={(e) => setSelectedGymId(e.target.value)} className="w-full p-2 border rounded">
              {gyms.map(g => <option key={g.id} value={g.id}>{g.name} ({g.id})</option>)}
            </select>
          </div>

          {/* File + Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <label className="block font-semibold text-gray-700">1. Select Legacy SQL File</label>
              <input 
                type="file" 
                accept=".sql" 
                onChange={handleFileChange}
                disabled={isMigrating}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div className="space-y-4">
              <label className="block font-semibold text-gray-700">2. Migration Settings</label>
              <div className="flex items-center space-x-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <input 
                  type="checkbox" 
                  id="dryRun" 
                  checked={isDryRun} 
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  disabled={isMigrating}
                  className="w-5 h-5 accent-amber-600"
                />
                <label htmlFor="dryRun" className="text-sm font-medium text-amber-800">
                  Enable Dry Run (Simulate only, no DB write)
                </label>
              </div>
            </div>
          </div>

      {/* Preview Card */}
      {preview && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h3 className="font-semibold">Preview Summary</h3>
          <p>Detected Tables: {preview.detectedTables?.join(', ') || 'None'}</p>
          <p>Users Seen: {preview.usersInserted ?? 'Unknown'}</p>
          <p>Staff Seen: {preview.staffInserted ?? 'Unknown'}</p>
          <p>Skipped payments: {preview.skippedPayments ?? 0}</p>
          {preview.warnings && preview.warnings.length > 0 && (
            <div className="mt-2 text-sm text-amber-700">
              <strong>Warnings:</strong>
              <ul className="list-disc ml-5">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
          {preview.skippedRows && preview.skippedRows.length > 0 && (
            <div className="mt-2">
              <button onClick={downloadSkippedCSV} className="px-3 py-2 bg-red-600 text-white rounded">Download Skipped Rows CSV</button>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {isMigrating && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-1">
            <span>Overall Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={runMigration}
        disabled={!file || isMigrating || !selectedGymId}
        className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
          isMigrating ? 'bg-gray-400' : isDryRun ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {isMigrating ? 'Processing...' : isDryRun ? 'Run Simulation' : 'Execute Final Migration'}
      </button>

      {/* Terminal Log */}
      <div className="mt-8">
        <h3 className="font-semibold mb-2 text-gray-700">Migration Log</h3>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-xs space-y-1">
          {logs.length === 0 && <span className="text-gray-500">// Waiting for file upload...</span>}
          {logs.map((log, i) => (
            <div key={i} className={`flex space-x-2 ${
              log.type === 'error' ? 'text-red-400' : 
              log.type === 'warning' ? 'text-amber-400' : 
              log.type === 'success' ? 'text-green-300' : 'text-blue-300'
            }`}>
              <span className="opacity-50">[{log.timestamp}]</span>
              <span>{log.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
      </div>
    </div>
  );
};