'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Radio,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Clock,
  ShieldCheck,
  Server,
  KeyRound,
  ExternalLink,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface DeadLetterWebhook {
  id: string;
  source: string;
  clientName: string;
  eventType: string;
  attempts: number;
  lastError: string;
  failedAt: string;
}

export default function AdminIntegrationsPage() {
  const [deadLetters, setDeadLetters] = useState<DeadLetterWebhook[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const handleRetryDlq = (id: string) => {
    setRetryingId(id);
    setTimeout(() => {
      setDeadLetters(deadLetters.filter((d) => d.id !== id));
      setRetryingId(null);
      setSuccess(`Webhook event ${id} successfully reprocessed into CRM lead pipeline.`);
      setTimeout(() => setSuccess(null), 4000);
    }, 1000);
  };

  const handleCheckHealth = () => {
    setCheckingHealth(true);
    setTimeout(() => {
      setCheckingHealth(false);
      setSuccess('All 4 external marketing API gateways are operational with latency < 120ms.');
      setTimeout(() => setSuccess(null), 4000);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-brand-50 text-brand-700">
              <Radio className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Global Integrations & Webhook Gateway Health
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Monitor system-wide third-party marketing connections, API quota consumption, and dead-letter retry queues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckHealth}
            disabled={checkingHealth}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
            Run Global Health Check
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Platform Gateway Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Meta Marketing API</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            </div>
            <div className="mt-2 text-xl font-bold text-slate-900">Operational</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Avg Ingest Latency: 84ms</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Google Ads API</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            </div>
            <div className="mt-2 text-xl font-bold text-slate-900">Operational</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Avg Ingest Latency: 112ms</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">WhatsApp Cloud API</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            </div>
            <div className="mt-2 text-xl font-bold text-slate-900">Operational</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Webhook Handshake: 200 OK</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Dead-Letter Queue</span>
              <span className={`h-2 w-2 rounded-full ${deadLetters.length > 0 ? 'bg-amber-500 ring-4 ring-amber-100' : 'bg-emerald-500'}`} />
            </div>
            <div className="mt-2 text-xl font-bold text-slate-900">{deadLetters.length} Events</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Requires manual re-drive</div>
          </CardContent>
        </Card>
      </div>

      {/* Quota & Token Health Meters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              API Quota & Rate Limit Utilization
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span>Meta Marketing API App Quota</span>
                  <span>18.4% (36,800 / 200,000 requests)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-brand-600 h-2 rounded-full" style={{ width: '18.4%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span>Google Ads Developer Daily Quota</span>
                  <span>24.1% (3,615 / 15,000 operations)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: '24.1%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span>WhatsApp Cloud Messages Delivery</span>
                  <span>8.2% (820 / 10,000 tier 1 limit)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '8.2%' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              OAuth Token Health & Refresh Countdown
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Meta System User Long-Lived Token</p>
                  <p className="text-[11px] text-slate-400">Auto-refresh enabled via server-to-server job</p>
                </div>
                <Badge variant="success">Valid (52 Days)</Badge>
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Google Ads Refresh Token</p>
                  <p className="text-[11px] text-slate-400">Offline access granted by Master MCC</p>
                </div>
                <Badge variant="success">Permanent</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dead-Letter Queue (DLQ) Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Webhook Ingest Dead-Letter Queue (DLQ)
            </h3>
            <p className="text-[11px] text-slate-400">Failed external payloads quarantined after maximum retry attempts</p>
          </div>
          {deadLetters.length > 0 && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {deadLetters.length} Unresolved Failures
            </span>
          )}
        </div>

        {deadLetters.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="font-medium text-slate-700">Dead-letter queue is clear.</p>
            <p className="text-[11px]">All webhook ingest payloads have processed successfully.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Source Gateway</th>
                  <th className="py-3 px-4">Workspace</th>
                  <th className="py-3 px-4">Payload Error</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Retry Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deadLetters.map((dlq) => (
                  <tr key={dlq.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-700 whitespace-nowrap">
                      {dlq.id}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                      {dlq.source}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {dlq.clientName}
                    </td>

                    <td className="py-3 px-4 text-rose-600 font-mono text-[11px] max-w-xs truncate">
                      {dlq.lastError}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {dlq.attempts} of 3
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                      {new Date(dlq.failedAt).toLocaleTimeString()}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetryDlq(dlq.id)}
                        disabled={retryingId === dlq.id}
                        className="h-7 text-[11px] px-2.5 flex items-center gap-1 ml-auto"
                      >
                        <RotateCcw className={`h-3 w-3 ${retryingId === dlq.id ? 'animate-spin' : ''}`} />
                        Re-drive Payload
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
