'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Settings, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getCurrentWorkspaceApi, updateWorkspaceSettingsApi, ClientItem } from '@/lib/clients';
import { getErrorMessage } from '@/lib/api';

export default function ClientSettingsPage() {
  const [client, setClient] = useState<ClientItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    brandPrimaryColor: '#1e40af',
    leadResponseThresholdMinutes: 30,
    notificationEmails: '',
  });

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCurrentWorkspaceApi();
        setClient(data);
        setForm({
          brandPrimaryColor: data.brandColor || data.settings?.brandPrimaryColor || '#1e40af',
          leadResponseThresholdMinutes: data.settings?.leadResponseThresholdMinutes || 30,
          notificationEmails: data.settings?.notificationEmails?.join(', ') || '',
        });
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const emails = form.notificationEmails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      const updated = await updateWorkspaceSettingsApi({
        brandPrimaryColor: form.brandPrimaryColor,
        leadResponseThresholdMinutes: Number(form.leadResponseThresholdMinutes),
        notificationEmails: emails,
      });

      setClient(updated);
      setSuccess('Workspace branding and settings updated successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        <span className="text-xs">Loading workspace settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-5 w-5 text-brand-700" />
          Workspace Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure agency SLA response alerts, brand identity colors, and stakeholder notification emails.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 border-b border-slate-100">
          <CardTitle className="text-xs font-bold text-slate-900">Workspace Brand & Preferences</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Brand Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brandPrimaryColor}
                  onChange={(e) => setForm({ ...form, brandPrimaryColor: e.target.value })}
                  className="h-8 w-12 border border-slate-300 rounded cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={form.brandPrimaryColor}
                  onChange={(e) => setForm({ ...form, brandPrimaryColor: e.target.value })}
                  className="w-28 text-xs px-2 py-1.5 border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Lead Response SLA Alert Threshold (Minutes)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={form.leadResponseThresholdMinutes}
                onChange={(e) =>
                  setForm({ ...form, leadResponseThresholdMinutes: parseInt(e.target.value, 10) })
                }
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
              />
              <p className="text-[11px] text-slate-400">
                FlumenX will trigger priority follow-up alerts if incoming marketing leads are not claimed within this time.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Notification Emails (Comma-separated)
              </label>
              <input
                type="text"
                value={form.notificationEmails}
                onChange={(e) => setForm({ ...form, notificationEmails: e.target.value })}
                placeholder="manager@client.com, ops@client.com"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
