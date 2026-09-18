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
      <div className="py-24 flex flex-col items-center justify-center text-sage-400 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-brand-800" />
        <span className="text-xs">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="border-b border-sage-200 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-forest-50 text-forest-800 border border-forest-100">
            <FileText className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal-900">
            Company Business Profile
          </h1>
        </div>
        <p className="text-xs text-sage-500 mt-1">
          Review and update company contact, website, and operating timezone information.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 shadow-soft-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-forest-50/80 border border-forest-200 rounded-xl text-xs text-forest-900 flex items-center gap-2 shadow-soft-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-forest-600" />
          <span>{success}</span>
        </div>
      )}

      <Card className="border-sage-200/90 shadow-soft-xs bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-5 border-b border-sage-100 bg-sage-50/40">
          <CardTitle className="text-sm font-bold text-charcoal-900">
            {client?.name || 'Client Workspace'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-charcoal-800">Legal Business Name</label>
              <input
                type="text"
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                placeholder="e.g. Acme Holdings LLC"
                className="w-full text-xs px-3.5 py-2.5 border border-sage-200 rounded-xl bg-sage-50/40 focus:bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-charcoal-800">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 border border-sage-200 rounded-xl bg-sage-50/40 focus:bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-charcoal-800">Website</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 border border-sage-200 rounded-xl bg-sage-50/40 focus:bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-charcoal-800">Timezone</label>
                <input
                  type="text"
                  value={form.timezone}
                  disabled
                  className="w-full text-xs px-3.5 py-2.5 border border-sage-200 bg-sage-50/80 text-sage-500 rounded-xl cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-charcoal-800">Currency</label>
                <input
                  type="text"
                  value={form.currency}
                  disabled
                  className="w-full text-xs px-3.5 py-2.5 border border-sage-200 bg-sage-50/80 text-sage-500 rounded-xl cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-3">
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="bg-brand-800 hover:bg-brand-900 text-white rounded-xl shadow-soft-xs px-4 py-2 gap-1.5"
              >
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
