import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, BarChart3, CheckCircle2, Clock, RefreshCw, TriangleAlert } from 'lucide-react';

type TimeRange = '7d' | '14d' | '30d';

interface DeliveryLog {
  id: string;
  notification_id: string | null;
  channel: string;
  status: string;
  provider_response: any | null;
  error_message?: string | null;
  attempt_number?: number | null;
  metadata?: any;
  created_at: string;
}

const rangeToDays: Record<TimeRange, number> = { '7d': 7, '14d': 14, '30d': 30 };

export function NotificationAnalytics() {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from('notification_delivery_logs')
        .select('id, notification_id, channel, status, provider_response, error_message, attempt_number, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      setLogs(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(rangeToDays[timeRange]);
  }, [timeRange]);

  const aggregates = useMemo(() => {
    const total = logs.length;
    const delivered = logs.filter(l => l.status === 'delivered').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const pending = logs.filter(l => l.status === 'pending').length;
    const sent = logs.filter(l => l.status === 'sent').length;
    const deliveryRate = total ? Math.round((delivered / total) * 1000) / 10 : 0;
    const avgAttempts =
      logs.length > 0
        ? Math.round(
            (logs.reduce((sum, l) => sum + (l.attempt_number || 1), 0) / logs.length) * 10
          ) / 10
        : 0;

    const byChannel = logs.reduce<Record<string, number>>((acc, l) => {
      acc[l.channel] = (acc[l.channel] || 0) + 1;
      return acc;
    }, {});

    const byStatus = logs.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    // Build daily trend
    const days = rangeToDays[timeRange];
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const trend = dayKeys.map((day) => {
      const dayLogs = logs.filter((l) => l.created_at.slice(0, 10) === day);
      return {
        day,
        delivered: dayLogs.filter((l) => l.status === 'delivered').length,
        failed: dayLogs.filter((l) => l.status === 'failed').length,
        sent: dayLogs.filter((l) => l.status === 'sent').length,
        pending: dayLogs.filter((l) => l.status === 'pending').length,
      };
    });
    const maxForScale = Math.max(
      1,
      ...trend.map((t) => t.delivered + t.failed + t.sent + t.pending)
    );

    // Top errors
    const errorCounts = logs
      .filter((l) => l.error_message && l.error_message.trim() !== '')
      .reduce<Record<string, number>>((acc, l) => {
        const msg = (l.error_message || '').trim();
        acc[msg] = (acc[msg] || 0) + 1;
        return acc;
      }, {});
    const topErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return {
      total,
      delivered,
      failed,
      pending,
      sent,
      deliveryRate,
      avgAttempts,
      byChannel,
      byStatus,
      trend,
      maxForScale,
      topErrors,
    };
  }, [logs, timeRange]);

  // Stacked bar chart helpers (responsive via viewBox)
  const chartWidth = 800;
  const chartHeight = 240;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = chartWidth - pad.left - pad.right;
  const innerH = chartHeight - pad.top - pad.bottom;

  const trendLen = aggregates.trend.length;
  const maxTotal = Math.max(
    1,
    ...aggregates.trend.map((t) => t.delivered + t.failed + t.sent + t.pending)
  );

  // band per day and bar width (centered within each band)
  const band = trendLen > 0 ? innerW / trendLen : innerW;
  const barW = Math.max(12, band * 0.6);
  const xCenterAt = (i: number) => pad.left + band * i + band / 2;
  const yAtTotal = (v: number) => pad.top + innerH * (1 - v / maxTotal);

  const series = [
    { key: 'delivered' as const, label: 'Delivered', color: '#22c55e' },
    { key: 'failed' as const, label: 'Failed', color: '#ef4444' },
    { key: 'sent' as const, label: 'Sent', color: '#60a5fa' },
    { key: 'pending' as const, label: 'Pending', color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            SMS Analytics
          </h2>
          <p className="text-gray-600">Insights from delivery logs</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v: TimeRange) => setTimeRange(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => fetchLogs(rangeToDays[timeRange])} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <CardDescription>All delivery entries</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold">{aggregates.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Delivered
            </CardTitle>
            <CardDescription>Successful deliveries</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold">{aggregates.delivered}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-red-600" />
              Failed
            </CardTitle>
            <CardDescription>Failed attempts</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold">{aggregates.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CardDescription>Delivered / Total</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold">{aggregates.deliveryRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Trend</CardTitle>
          <CardDescription>Events per day by status</CardDescription>
        </CardHeader>
        <CardContent>
          {aggregates.trend.length === 0 ? (
            <div className="text-sm text-gray-500">No data in selected range.</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <svg
                className="w-full"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-label="Daily trend stacked bar chart"
              >
                {/* Y-axis grid lines and labels */}
                {Array.from({ length: 5 }).map((_, idx) => {
                  const yVal = (maxTotal * idx) / 4;
                  const y = yAtTotal(yVal);
                  return (
                    <g key={idx}>
                      <line
                        x1={pad.left}
                        y1={y}
                        x2={chartWidth - pad.right}
                        y2={y}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      <text
                        x={pad.left - 8}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fontSize="10"
                        fill="#6b7280"
                      >
                        {Math.round(yVal)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis labels (dates) */}
                {aggregates.trend.map((t, i) => (
                  <text
                    key={t.day}
                    x={xCenterAt(i)}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#6b7280"
                  >
                    {t.day.slice(5)}{/* MM-DD */}
                  </text>
                ))}

                {/* Stacked bars */}
                {aggregates.trend.map((t, i) => {
                  const x = xCenterAt(i) - barW / 2;
                  let cum = 0;
                  return (
                    <g key={`bar-${t.day}`}>
                      {series.map((s) => {
                        const val = t[s.key];
                        const y0 = yAtTotal(cum);
                        const y1 = yAtTotal(cum + val);
                        const h = Math.max(0, y0 - y1);
                        cum += val;
                        return (
                          <rect
                            key={`${t.day}-${s.key}`}
                            x={x}
                            y={y1}
                            width={barW}
                            height={h}
                            fill={s.color}
                            rx={2}
                            ry={2}
                          >
                            <title>
                              {`${t.day} • ${s.label}: ${val}`}
                            </title>
                          </rect>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {series.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-2 w-4 rounded"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-gray-700">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Top Errors</CardTitle>
          <CardDescription>Most frequent error messages</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 border rounded-md">
            <div className="p-3 space-y-2">
              {aggregates.topErrors.length === 0 ? (
                <div className="text-sm text-gray-500">No errors recorded</div>
              ) : (
                aggregates.topErrors.map((e) => (
                  <div key={e.message} className="flex items-start justify-between gap-3">
                    <div className="flex-1 text-sm break-words">{e.message}</div>
                    <Badge variant="outline">{e.count}</Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="text-xs text-gray-500">
        Note: Metrics are computed from Delivery logs found from within the DB on the selected time range.
      </div>
    </div>
  );
} 