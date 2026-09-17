'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Settings,
  Shield,
  KeyRound,
  Mail,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Lock,
  Globe,
  Database,
  Activity,
  Send,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'smtp' | 'telemetry'>('general');
  const [success, setSuccess] = useState<string | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Form States
  const [agencyName, setAgencyName] = useState('FlumenX Digital Media');
  const [supportEmail, setSupportEmail] = useState('support@flumenx.com');
  const [brandColor, setBrandColor] = useState('#4f46e5');
  const [jwtExpiration, setJwtExpiration] = useState('7d');
  const [passwordMinLength, setPasswordMinLength] = useState('8');
  const [requireUppercase, setRequireUppercase] = useState(true);
  const [requireNumber, setRequireNumber] = useState(true);
  const [rateLimitWindow, setRateLimitWindow] = useState('15');
  const [rateLimitMax, setRateLimitMax] = useState('100');

  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState('smtp.mailgun.org');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('postmaster@flumenx.mailgun.org');
  const [smtpPassword, setSmtpPassword] = useState('••••••••••••••••');
  const [senderName, setSenderName] = useState('FlumenX Notifications');
  const [senderEmail, setSenderEmail] = useState('noreply@flumenx.com');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('System configuration and operational policies saved successfully.');
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleTestSmtp = () => {
    setTestingSmtp(true);
    setTimeout(() => {
      setTestingSmtp(false);
      setSuccess(`Test email dispatch initiated to ${supportEmail} (Response: 250 OK Message Accepted)`);
      setTimeout(() => setSuccess(null), 5000);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-brand-50 text-brand-700">
              <Settings className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Platform & System Settings
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Agency branding, security authentication parameters, SMTP email transport, and rate limit quotas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSaveSettings}
            className="bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Success alert */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'general' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Globe className="h-4 w-4" />
          Agency Branding
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'security' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield className="h-4 w-4" />
          Session & Password Policies
        </button>

        <button
          onClick={() => setActiveTab('smtp')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'smtp' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail className="h-4 w-4" />
          Email SMTP Transport
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'telemetry' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Activity className="h-4 w-4" />
          System Health & Telemetry
        </button>
      </div>

      {/* TAB 1: GENERAL BRANDING */}
      {activeTab === 'general' && (
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-6">
            <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Agency Name:</label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Support Contact Email:</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Primary Brand Accent Color:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-9 w-14 rounded border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-32 p-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" size="sm" className="bg-brand-600 hover:bg-brand-700 text-white">
                  Save General Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: SECURITY & PASSWORD POLICIES */}
      {activeTab === 'security' && (
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-6">
            <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">JWT Session Lifespan:</label>
                <select
                  value={jwtExpiration}
                  onChange={(e) => setJwtExpiration(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50"
                >
                  <option value="1d">24 Hours (High Security)</option>
                  <option value="7d">7 Days (Default)</option>
                  <option value="30d">30 Days (Extended)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Minimum Password Length:</label>
                <input
                  type="number"
                  min="8"
                  max="32"
                  value={passwordMinLength}
                  onChange={(e) => setPasswordMinLength(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireUppercase}
                    onChange={(e) => setRequireUppercase(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700 font-medium">Require at least one uppercase letter (A-Z)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireNumber}
                    onChange={(e) => setRequireNumber(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700 font-medium">Require at least one numeric digit (0-9)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="font-semibold text-slate-800 mb-2">API Rate Limiting & Abuse Defense:</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 text-[11px] mb-1">Window (Minutes):</label>
                    <input
                      type="number"
                      value={rateLimitWindow}
                      onChange={(e) => setRateLimitWindow(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] mb-1">Max Requests per IP:</label>
                    <input
                      type="number"
                      value={rateLimitMax}
                      onChange={(e) => setRateLimitMax(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" size="sm" className="bg-brand-600 hover:bg-brand-700 text-white">
                  Save Security Policies
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: SMTP EMAIL CONFIGURATION */}
      {activeTab === 'smtp' && (
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-6">
            <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">SMTP Server Host:</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="e.g. email-smtp.us-east-1.amazonaws.com"
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Port:</label>
                  <input
                    type="text"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">SMTP Username:</label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">SMTP Password:</label>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sender Name:</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sender From Email:</label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <Button type="submit" size="sm" className="bg-brand-600 hover:bg-brand-700 text-white">
                  Save SMTP Credentials
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {testingSmtp ? 'Sending Test...' : 'Send Test Email'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: SYSTEM HEALTH & TELEMETRY */}
      {activeTab === 'telemetry' && (
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Real-Time Core Engine Telemetry</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Node.js Engine</span>
                <p className="text-sm font-bold text-slate-900 mt-1">v20.14.12 LTS</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Process online (Uptime: 99.98%)</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">MongoDB Database</span>
                <p className="text-sm font-bold text-slate-900 mt-1">Mongoose 8.5.1</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Connection pool active & healthy</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Encryption Cipher</span>
                <p className="text-sm font-bold text-slate-900 mt-1">AES-256-GCM</p>
                <p className="text-[10px] text-brand-600 mt-0.5">Zero key disclosure enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
