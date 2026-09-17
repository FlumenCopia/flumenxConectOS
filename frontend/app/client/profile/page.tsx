'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getCurrentWorkspaceApi, updateWorkspaceSettingsApi, ClientItem } from '@/lib/clients';
import { getErrorMessage } from '@/lib/api';

export default function ClientBusinessProfilePage() {
  const [client, setClient] = useState<ClientItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    legalName: '',
    phone: '',
    website: '',
    timezone: '',
    currency: '',
  });

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCurrentWorkspaceApi();
        setClient(data);
        setForm({
          legalName: data.legalName || '',
          phone: data.phone || '',
          website: data.website || '',
          timezone: data.timezone || 'America/New_York',
          currency: data.currency || 'USD',
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
      const updated = await updateWorkspaceSettingsApi(form);
      setClient(updated);
      setSuccess('Business profile details updated successfully.');
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
        <span className="text-xs">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-700" />
          Company Business Profile
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review and update company contact, website, and operating timezone information.
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
          <CardTitle className="text-xs font-bold text-slate-900">
            {client?.name || 'Client Workspace'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Legal Business Name</label>
              <input
                type="text"
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                placeholder="e.g. Acme Holdings LLC"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Website</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Timezone</label>
                <input
                  type="text"
                  value={form.timezone}
                  disabled
                  className="w-full text-xs px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-md"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Currency</label>
                <input
                  type="text"
                  value={form.currency}
                  disabled
                  className="w-full text-xs px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-md"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Business Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
