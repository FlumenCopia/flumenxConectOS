'use client';

import React, { useEffect, useState } from 'react';
import { usePortalAuth } from '@/context/PortalAuthContext';
import {
  portalGetProfileApi,
  portalUpdateProfileApi,
  portalRequestProfileChangeApi,
  PortalUserProfile,
} from '@/lib/api/portal';
import {
  User,
  Phone,
  Mail,
  Building,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileEdit,
  X,
} from 'lucide-react';

export default function PortalProfilePage() {
  const { user, refreshUser } = usePortalAuth();
  const [profile, setProfile] = useState<PortalUserProfile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [emailPref, setEmailPref] = useState(true);
  const [smsPref, setSmsPref] = useState(true);
  const [whatsappPref, setWhatsappPref] = useState(false);
  const [marketingPref, setMarketingPref] = useState(false);
  const [consentGiven, setConsentGiven] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Change Request Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [changeFieldName, setChangeFieldName] = useState('email');
  const [changeValue, setChangeValue] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const data = await portalGetProfileApi();
        if (isMounted) {
          setProfile(data);
          setName(data.name || '');
          setPhone(data.phone || '');
          setEmailPref(data.communicationPreferences?.email ?? true);
          setSmsPref(data.communicationPreferences?.sms ?? true);
          setWhatsappPref(data.communicationPreferences?.whatsapp ?? false);
          setMarketingPref(data.communicationPreferences?.marketing ?? false);
          setConsentGiven(data.consentGiven ?? true);
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage('Failed to load profile details');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updated = await portalUpdateProfileApi({
        name: name.trim(),
        phone: phone.trim(),
        communicationPreferences: {
          email: emailPref,
          sms: smsPref,
          whatsapp: whatsappPref,
          marketing: marketingPref,
        },
        consentGiven,
      });

      setProfile(updated);
      await refreshUser();
      setSuccessMessage('Profile and preferences updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChangeModal = (fieldName: string) => {
    setChangeFieldName(fieldName);
    setChangeValue('');
    setChangeReason('');
    setModalOpen(true);
  };

  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingChange(true);
    setErrorMessage(null);

    try {
      await portalRequestProfileChangeApi({
        fieldName: changeFieldName,
        requestedValue: changeValue.trim(),
        reason: changeReason.trim() || undefined,
      });

      setModalOpen(false);
      setSuccessMessage(
        `Your request to update "${changeFieldName}" has been submitted for staff review.`
      );
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to submit change request.');
    } finally {
      setSubmittingChange(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Loading profile settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Profile & Preferences</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your contact information, communication channels, and consent settings
        </p>
      </div>

      {successMessage && (
        <div
          id="profile-success-alert"
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center space-x-3"
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          id="profile-error-alert"
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center space-x-3"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-8">
        {/* Personal Details Section */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Contact Information</h2>
              <p className="text-xs text-slate-400">Update your direct contact information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="profile-name-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="profile-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-phone-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="profile-phone-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>
            </div>

            {/* Read-Only Account Email with Change Request */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Registered Email
                </label>
                <button
                  type="button"
                  id="request-email-change-btn"
                  onClick={() => handleOpenChangeModal('email')}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                >
                  <FileEdit className="w-3 h-3" />
                  <span>Request Change</span>
                </button>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-400 text-sm cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                For security reasons, changing your login email requires staff verification.
              </p>
            </div>

            {/* Workspace Organization */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Workspace
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  disabled
                  value={profile?.clientName || 'Workspace'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-400 text-sm cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Communication Preferences */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-violet-600/15 text-violet-400 flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Communication Preferences</h2>
              <p className="text-xs text-slate-400">Choose which channels you want to receive notifications on</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">Email Notifications</p>
                <p className="text-xs text-slate-400">Receive request updates and task alerts via email</p>
              </div>
              <input
                id="pref-email-toggle"
                type="checkbox"
                checked={emailPref}
                onChange={(e) => setEmailPref(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-700 border-slate-600"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">SMS Updates</p>
                <p className="text-xs text-slate-400">Receive urgent ticket alerts and time-sensitive reminders</p>
              </div>
              <input
                id="pref-sms-toggle"
                type="checkbox"
                checked={smsPref}
                onChange={(e) => setSmsPref(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-700 border-slate-600"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">WhatsApp Messages</p>
                <p className="text-xs text-slate-400">Receive conversation replies on WhatsApp</p>
              </div>
              <input
                id="pref-whatsapp-toggle"
                type="checkbox"
                checked={whatsappPref}
                onChange={(e) => setWhatsappPref(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-700 border-slate-600"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">Marketing & Product Updates</p>
                <p className="text-xs text-slate-400">Receive newsletters, product news, and feature announcements</p>
              </div>
              <input
                id="pref-marketing-toggle"
                type="checkbox"
                checked={marketingPref}
                onChange={(e) => setMarketingPref(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-700 border-slate-600"
              />
            </label>
          </div>
        </div>

        {/* Consent & Data Privacy */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/15 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Privacy & Consent</h2>
              <p className="text-xs text-slate-400">Data privacy rights and compliance settings</p>
            </div>
          </div>

          <label className="flex items-start space-x-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 cursor-pointer">
            <input
              id="consent-toggle"
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-700 border-slate-600 flex-shrink-0"
            />
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-white block mb-0.5">Consent to Process Data</span>
              I authorize {profile?.clientName || 'the workspace'} to store and process my contact information,
              support tickets, and communications in compliance with applicable privacy regulations.
              {profile?.consentGivenAt && (
                <span className="block text-[11px] text-slate-500 mt-1">
                  Last recorded: {new Date(profile.consentGivenAt).toLocaleString()}
                </span>
              )}
            </div>
          </label>
        </div>

        {/* Submit button */}
        <div className="flex justify-end">
          <button
            id="profile-save-btn"
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center space-x-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </form>

      {/* Modal: Formal Profile Change Request */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Request Profile Update</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Submit a formal request to change your protected profile fields (such as email, legal name, or corporate entity).
            </p>

            <form onSubmit={handleSubmitChangeRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Field to Update
                </label>
                <input
                  type="text"
                  disabled
                  value={changeFieldName}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-mono capitalize"
                />
              </div>

              <div>
                <label htmlFor="change-requested-value-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Requested New Value
                </label>
                <input
                  id="change-requested-value-input"
                  type="text"
                  required
                  value={changeValue}
                  onChange={(e) => setChangeValue(e.target.value)}
                  placeholder={`Enter your updated ${changeFieldName}`}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>

              <div>
                <label htmlFor="change-reason-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reason for Request (Optional)
                </label>
                <textarea
                  id="change-reason-input"
                  rows={3}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Provide context for this update..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  id="submit-change-request-btn"
                  type="submit"
                  disabled={submittingChange}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/25 flex items-center space-x-2"
                >
                  {submittingChange ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
