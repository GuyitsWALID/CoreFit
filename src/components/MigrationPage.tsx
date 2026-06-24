import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, FileText, Menu, Play, Upload, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { buildLegacyMigrationPlan, LegacyMigrationPlan } from '@/utils/legacyMigration';

type Gym = { id: string; name: string };
type UploadFile = { name: string; content: string; size: number };
type Preview = {
  detectedTables: string[];
  sourceCounts: Record<string, number>;
  packagesInserted: number;
  usersInserted: number;
  staffInserted: number;
  paymentsInserted: number;
  freezesInserted: number;
  checkinsInserted: number;
  trainerAssignmentsInserted?: number;
  skippedRows: Array<{ table: string; row?: number; reason: string }>;
  skippedCount: number;
  warnings: string[];
  ready: boolean;
};
type MigrationJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'completed_with_issues' | 'failed';
  progress: number;
  current_step?: string;
  result?: any;
  error_message?: string;
};
type TerminalEntry = {
  time: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
};

const getFunctionsBase = () =>
  (import.meta.env.VITE_MIGRATE_FUNCTIONS_BASE as string | undefined)
  ?? `${String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1`;

const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in with an admin account before running a migration.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
};

export const MigrationDashboard: React.FC = () => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [migrationPlan, setMigrationPlan] = useState<LegacyMigrationPlan | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState<MigrationJob | null>(null);
  const [error, setError] = useState('');
  const [terminal, setTerminal] = useState<TerminalEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const terminalEnd = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const functionsBase = useMemo(getFunctionsBase, []);

  const addLog = (message: string, level: TerminalEntry['level'] = 'info') => {
    setTerminal(current => [...current, {
      time: new Date().toLocaleTimeString(),
      level,
      message,
    }]);
  };

  useEffect(() => {
    terminalEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminal]);

  useEffect(() => {
    supabase.from('gyms').select('id,name').eq('status', 'active').order('name').then(({ data }) => {
      const rows = (data ?? []) as Gym[];
      setGyms(rows);
      if (rows[0]) setGymId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${functionsBase}/migrate-run`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ action: 'status', jobId: job.id }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not read migration status.');
        if (payload.job.current_step !== job.current_step || payload.job.progress !== job.progress) {
          addLog(`${payload.job.current_step || payload.job.status} (${payload.job.progress}%)`);
        }
        if (payload.job.status === 'completed') addLog('Migration completed successfully.', 'success');
        if (payload.job.status === 'completed_with_issues') addLog('Migration completed with quarantined rows. Review the result below.', 'warning');
        if (payload.job.status === 'failed') addLog(payload.job.error_message || 'Migration failed.', 'error');
        setJob(payload.job);
      } catch (statusError: any) {
        setError(statusError.message);
        addLog(`Status check failed: ${statusError.message}`, 'error');
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, functionsBase]);

  const previewFiles = async (selectedFiles: UploadFile[]) => {
    if (!gymId || !selectedFiles.length) return;
    setPreviewing(true);
    setError('');
    setPreview(null);
    try {
      addLog('Splitting the full export into independent legacy tables…');
      await new Promise(resolve => window.setTimeout(resolve, 20));
      const plan = buildLegacyMigrationPlan(selectedFiles.map(file => file.content), gymId);
      setMigrationPlan(plan);
      const raw = {
        detectedTables: plan.detectedTables,
        sourceCounts: plan.sourceCounts,
        packagesInserted: plan.packages.length,
        usersInserted: plan.users.length,
        staffInserted: plan.staff.length,
        paymentsInserted: plan.payments.length,
        freezesInserted: plan.membershipFreezes.length,
        checkinsInserted: plan.clientCheckins.length,
        trainerAssignmentsInserted: plan.trainerAssignments.length,
        skippedRows: plan.issues.slice(0, 200),
        skippedCount: plan.issues.length,
        warnings: plan.warnings,
        ready: plan.users.length > 0 || plan.packages.length > 0 || plan.staff.length > 0,
      };
      const normalized: Preview = {
        detectedTables: raw.detectedTables ?? [],
        sourceCounts: raw.sourceCounts ?? {},
        packagesInserted: raw.packagesInserted ?? raw.packagesCreated ?? 0,
        usersInserted: raw.usersInserted ?? 0,
        staffInserted: raw.staffInserted ?? 0,
        paymentsInserted: raw.paymentsInserted ?? 0,
        freezesInserted: raw.freezesInserted ?? 0,
        checkinsInserted: raw.checkinsInserted ?? 0,
        skippedRows: raw.skippedRows ?? [],
        skippedCount: raw.skippedCount ?? raw.skippedRows?.length ?? raw.skippedPayments ?? 0,
        warnings: raw.warnings ?? [],
        ready: raw.ready ?? ((raw.usersInserted ?? 0) + (raw.staffInserted ?? 0) + (raw.packagesInserted ?? raw.packagesCreated ?? 0) + (raw.paymentsInserted ?? 0) > 0),
      };
      setPreview(normalized);
      for (const table of normalized.detectedTables) {
        addLog(`Parsed ${table}: ${normalized.sourceCounts[table] ?? 0} source row(s).`, 'success');
        await new Promise(resolve => window.setTimeout(resolve, 0));
      }
      addLog(`Local validation complete. Detected tables: ${normalized.detectedTables.join(', ') || 'none'}.`, 'success');
      addLog(`Plan: ${normalized.usersInserted} members, ${normalized.packagesInserted} packages, ${normalized.paymentsInserted} payments, ${normalized.checkinsInserted} check-ins.`);
      if (normalized.skippedCount) addLog(`${normalized.skippedCount} row(s) will be quarantined.`, 'warning');
    } catch (previewError: any) {
      const message = previewError.message;
      setError(message);
      addLog(`Preview failed: ${message}`, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const selectFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    setTerminal([]);
    addLog(`Selected ${selected.length} legacy export file(s).`);
    const loaded: UploadFile[] = [];
    const allDetectedTables = new Set<string>();
    for (const file of selected) {
      addLog(`Reading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)…`);
      const content = await file.text();
      loaded.push({ name: file.name, content, size: file.size });
      const tables = [...content.matchAll(/(?:CREATE\s+TABLE|INSERT\s+INTO)\s+(?:[`"']?[\w]+[`"']?\.)?[`"']?([A-Za-z_][A-Za-z0-9_]*)/gi)]
        .map(match => match[1].toLowerCase());
      const uniqueTables = [...new Set(tables)];
      uniqueTables.forEach(table => allDetectedTables.add(table));
      addLog(`${file.name}: found ${uniqueTables.length} table(s): ${uniqueTables.join(', ') || 'none'}.`, uniqueTables.length ? 'success' : 'warning');
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }
    setFiles(loaded);
    setJob(null);
    setPreview(null);
    setMigrationPlan(null);

    const hasMembers = ['users', 'members', 'clients'].some(table => allDetectedTables.has(table));
    const hasDependentHistory = ['payments', 'payment', 'checkins', 'clientcheckins'].some(table => allDetectedTables.has(table));
    if (!hasMembers && hasDependentHistory) {
      const message = 'The selected export contains payment/check-in history but no Users table. Select this file together with the separate Users SQL export (for example, Users (2).sql).';
      setError(message);
      addLog('BLOCKED: No Users table was found in the selected export.', 'error');
      addLog('Payments and check-ins reference member IDs, so migrating without Users would create orphaned records.', 'warning');
      addLog('Choose the full dump and Users (2).sql together in the same file picker, then retry.', 'info');
      setPreviewing(false);
      return;
    }

    setError('');
    addLog('Local scan complete. Building the migration plan table-by-table…');
    await previewFiles(loaded);
  };

  const startMigration = async () => {
    if (!preview?.ready || !migrationPlan || !files.length || !gymId) return;
    setStarting(true);
    setError('');
    try {
      addLog('Uploading the normalized migration plan (raw SQL parsing is already complete)…');
      const response = await fetch(`${functionsBase}/migrate-run`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          gymId,
          plan: migrationPlan,
          files: files.map(file => ({ name: file.name, size: file.size })),
          dryRun: false,
          finalConfirm: 'MIGRATE',
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        try {
          throw new Error(JSON.parse(text).error || text);
        } catch (parseError) {
          if (parseError instanceof SyntaxError) throw new Error(text || `Migration failed with HTTP ${response.status}.`);
          throw parseError;
        }
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream')) {
        addLog('Connected to legacy streaming migration endpoint.', 'warning');
        if (!response.body) throw new Error('The migration stream is unavailable.');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const event of events) {
            const line = event.split(/\r?\n/).find(item => item.startsWith('data:'));
            if (!line) continue;
            const data = JSON.parse(line.replace(/^data:\s*/, ''));
            if (data.type === 'progress') addLog(`${data.message || 'Migrating data'} (${data.percent ?? 0}%)`);
            if (data.type === 'error') throw new Error(data.message || 'Migration failed.');
            if (data.type === 'done') addLog('Migration completed.', 'success');
          }
        }
      } else {
        const payload = await response.json();
        if (!payload.jobId) throw new Error(payload.error || 'The migration endpoint did not return a job ID.');
        setJob({ id: payload.jobId, status: 'queued', progress: 0, current_step: 'Waiting to start' });
        addLog(`Background migration job created: ${payload.jobId}`, 'success');
      }
    } catch (startError: any) {
      setError(startError.message);
      addLog(`Migration failed: ${startError.message}`, 'error');
    } finally {
      setStarting(false);
    }
  };

  const planned = preview ? [
    ['Packages', preview.packagesInserted],
    ['Members', preview.usersInserted],
    ['Staff', preview.staffInserted],
    ['Payments', preview.paymentsInserted],
    ['Freezes', preview.freezesInserted],
    ['Check-ins', preview.checkinsInserted],
  ] : [];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="flex-1 overflow-y-auto">
        {isMobile && (
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-white px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}><Menu /></Button>
            <span className="font-semibold text-blue-600">Super Admin</span>
          </div>
        )}

        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Automatic Legacy Migration</h1>
            <p className="mt-1 text-gray-500">Upload one full phpMyAdmin SQL export, or select Users, Packages, Payments, CheckIns, and Admins exports together.</p>
          </div>

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>1. Choose gym and exports</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <select value={gymId} onChange={event => setGymId(event.target.value)} className="w-full rounded-md border p-3">
                {gyms.map(gym => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
              <input ref={fileInput} type="file" multiple accept=".sql,.txt" onChange={selectFiles} className="hidden" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center hover:bg-blue-50"
              >
                <Upload className="mb-3 h-10 w-10 text-blue-600" />
                <span className="font-semibold">Select SQL export file(s)</span>
                <span className="mt-1 text-sm text-gray-500">You can select all separate table exports in one action.</span>
              </button>
              {!!files.length && (
                <div className="grid gap-2 md:grid-cols-2">
                  {files.map(file => (
                    <div key={file.name} className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div className="min-w-0"><div className="truncate font-medium">{file.name}</div><div className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div></div>
                    </div>
                  ))}
                </div>
              )}
              {previewing && <div className="flex items-center gap-2 text-blue-700"><Database className="h-5 w-5 animate-pulse" /> Parsing and validating exports…</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Parsing and migration terminal</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72 overflow-y-auto rounded-lg bg-gray-950 p-4 font-mono text-xs">
                {terminal.length === 0 && <div className="text-gray-500">// Select a legacy SQL export to begin…</div>}
                {terminal.map((entry, index) => (
                  <div
                    key={`${entry.time}-${index}`}
                    className={
                      entry.level === 'error' ? 'text-red-400'
                        : entry.level === 'warning' ? 'text-amber-300'
                          : entry.level === 'success' ? 'text-green-400'
                            : 'text-sky-300'
                    }
                  >
                    <span className="mr-2 text-gray-600">[{entry.time}]</span>{entry.message}
                  </div>
                ))}
                <div ref={terminalEnd} />
              </div>
            </CardContent>
          </Card>

          {preview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {preview.ready ? <CheckCircle2 className="text-green-600" /> : <AlertTriangle className="text-amber-600" />}
                  2. Validated migration plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {preview.detectedTables.map(table => <Badge key={table} variant="outline">{table}{preview.sourceCounts[table] !== undefined ? `: ${preview.sourceCounts[table]}` : ''}</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  {planned.map(([label, count]) => (
                    <div key={String(label)} className="rounded-lg border bg-gray-50 p-3 text-center">
                      <div className="text-2xl font-bold">{count}</div><div className="text-xs text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
                {(preview.warnings.length > 0 || preview.skippedRows.length > 0) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="font-semibold">{preview.skippedCount} malformed or orphaned rows will be safely quarantined.</div>
                    {preview.warnings.map(warning => <div key={warning} className="mt-1">{warning}</div>)}
                    {preview.skippedRows.slice(0, 5).map((issue, index) => <div key={index} className="mt-1">{issue.table}{issue.row ? ` row ${issue.row}` : ''}: {issue.reason}</div>)}
                    {preview.skippedCount > 5 && <div className="mt-1">…and {preview.skippedCount - 5} more, included in the final report.</div>}
                  </div>
                )}
                <Button size="lg" className="w-full" disabled={!preview.ready || !migrationPlan || starting || !!job} onClick={startMigration}>
                  <Play className="mr-2 h-5 w-5" />{starting ? 'Starting…' : 'Start Automatic Migration'}
                </Button>
              </CardContent>
            </Card>
          )}

          {job && (
            <Card>
              <CardHeader><CardTitle>3. Background migration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><div className="font-medium">{job.current_step || job.status}</div><div className="text-sm text-gray-500">Job {job.id}</div></div>
                  <Badge variant={job.status === 'failed' ? 'destructive' : 'outline'}>{job.status.replace(/_/g, ' ')}</Badge>
                </div>
                <Progress value={job.progress} />
                <div className="text-right text-sm font-medium">{job.progress}%</div>
                {job.error_message && <div className="rounded-lg bg-red-50 p-4 text-red-700">{job.error_message}</div>}
                {job.result?.counts && (
                  <div className="grid gap-3 md:grid-cols-3">
                    {Object.entries(job.result.counts).map(([table, value]: [string, any]) => (
                      <div key={table} className="rounded-lg border p-3">
                        <div className="font-medium">{table.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-gray-500">Written {value.written} · Skipped {value.skipped}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};
