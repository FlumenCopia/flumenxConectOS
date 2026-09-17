'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Zap,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  MessageSquare,
  Globe,
  Share2,
  Copy,
  Check,
  X,
  Megaphone,
  Info,
  Smartphone,
  Mail,
  HelpCircle,
  Sliders,
  Settings,
  Shield,
  Send,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  getAdConnectionsApi,
  createAdConnectionApi,
  revokeAdConnectionApi,
  syncAdConnectionApi,
  AdPlatformConnectionItem,
  AdPlatform,
} from '@/lib/ads';
import {
  getCommunicationProvidersApi,
  saveCommunicationProviderApi,
  deleteCommunicationProviderApi,
  testCommunicationProviderApi,
  CommunicationProviderItem,
  ProviderType,
} from '@/lib/conversations';

// Configuration Tooltip Data for (i) icons
const FIELD_TIPS: Record<string, { title: string; steps: string[]; link?: { url: string; label: string } }> = {
  // WhatsApp
  whatsapp_phoneNumberId: {
    title: 'WhatsApp Phone Number ID',
    steps: [
      'Log into developers.facebook.com and open your Meta App.',
      'In the left sidebar, click "WhatsApp" > "API Setup".',
      'Under Step 1 ("Send and receive messages"), copy the numeric "Phone number ID".',
      'Note: This is different from your display phone number or WABA ID.',
    ],
    link: { url: 'https://developers.facebook.com/apps', label: 'Meta App Dashboard' },
  },
  whatsapp_wabaId: {
    title: 'WhatsApp Business Account ID (WABA ID)',
    steps: [
      'Go to developers.facebook.com > Your App > WhatsApp > API Setup.',
      'Copy the "WhatsApp Business Account ID" shown right below the Phone number ID.',
      'Alternatively, visit business.facebook.com > Settings > WhatsApp Accounts.',
    ],
    link: { url: 'https://business.facebook.com/settings/whatsapp-business-accounts', label: 'Meta Business Suite' },
  },
  whatsapp_accessToken: {
    title: 'Permanent Meta System User Token',
    steps: [
      'Go to business.facebook.com > Settings > Users > System Users.',
      'Create a System User with "Admin" role (e.g., "FlumenX WhatsApp Bot").',
      'Click "Add Assets" and assign your WhatsApp Business Account with full control.',
      'Click "Generate New Token", select your App, and enable permissions: whatsapp_business_messaging, whatsapp_business_management.',
      'Set token expiration to "Never" so automated messaging never expires.',
    ],
    link: { url: 'https://business.facebook.com/settings/system-users', label: 'Meta System Users' },
  },
  whatsapp_verifyToken: {
    title: 'Webhook Verify Token',
    steps: [
      'Create a secret verification string (e.g. "flumenx_wa_secret_token_2026").',
      'Paste the exact same string into your Meta App > WhatsApp > Configuration > Edit Webhook.',
      'Meta will make a GET challenge request with this token to verify your webhook URL.',
    ],
  },

  // Instagram Direct
  instagram_accountId: {
    title: 'Instagram Business Account ID',
    steps: [
      'Ensure your Instagram profile is switched to a Professional/Business account.',
      'Connect your Instagram account to your Facebook Business Page.',
      'In Meta Business Suite > Settings > Accounts > Instagram accounts, copy your numeric Instagram ID.',
      'Or open Graph API Explorer and query: GET /me/accounts?fields=instagram_business_account.',
    ],
    link: { url: 'https://business.facebook.com/settings/instagram-account', label: 'Instagram Accounts' },
  },
  instagram_pageAccessToken: {
    title: 'Page Access Token (Instagram Messages)',
    steps: [
      'In developers.facebook.com > Tools > Graph API Explorer, select your App and Page.',
      'Add permissions: instagram_basic, instagram_manage_messages, pages_manage_metadata, pages_messaging.',
      'Generate Access Token and verify using the Access Token Debugger tool.',
    ],
    link: { url: 'https://developers.facebook.com/tools/explorer/', label: 'Graph API Explorer' },
  },

  // Facebook Messenger
  messenger_pageId: {
    title: 'Facebook Page ID',
    steps: [
      'Open your Facebook Page in a browser.',
      'Click "About" > "Page transparency" or go to Page Settings.',
      'Copy the numeric Page ID (e.g. 104829104857291).',
    ],
  },
  messenger_pageAccessToken: {
    title: 'Page Access Token (Messenger)',
    steps: [
      'Go to developers.facebook.com > Your App > Messenger > Settings.',
      'Under "Access Tokens", select your Facebook Page and click "Generate Token".',
      'Copy the token. Make sure your Meta App is published or testing users are added.',
    ],
    link: { url: 'https://developers.facebook.com/apps', label: 'Messenger App Settings' },
  },

  // Twilio
  twilio_accountSid: {
    title: 'Twilio Account SID',
    steps: [
      'Log into your Twilio Console (console.twilio.com).',
      'On the Dashboard, scroll to the "Account Info" section.',
      'Copy your Account SID (starts with "AC...").',
    ],
    link: { url: 'https://console.twilio.com', label: 'Twilio Console' },
  },
  twilio_authToken: {
    title: 'Twilio Auth Token',
    steps: [
      'In the Twilio Console Dashboard under "Account Info", click "Show" next to Auth Token.',
      'Copy the 32-character primary Auth Token.',
    ],
  },
  twilio_fromNumber: {
    title: 'Twilio Sender Number',
    steps: [
      'In Twilio Console > Phone Numbers > Manage > Active numbers.',
      'Copy your purchased E.164 phone number (e.g. +14155552671).',
      'For WhatsApp via Twilio, use format: whatsapp:+14155552671.',
    ],
  },

  // Resend / Email
  resend_apiKey: {
    title: 'Resend API Key',
    steps: [
      'Log into resend.com and go to the "API Keys" section.',
      'Click "Create API Key", give it a name and "Full access" or "Sending access".',
      'Copy the key immediately (starts with "re_...").',
    ],
    link: { url: 'https://resend.com/api-keys', label: 'Resend API Keys' },
  },
  resend_fromEmail: {
    title: 'Verified Sender Email Address',
    steps: [
      'In Resend > Domains, ensure your custom domain (e.g. yourcompany.com) is verified with DKIM/SPF DNS records.',
      'Enter an email using that verified domain (e.g., support@yourcompany.com).',
      'For testing without custom domain, you can use onboarding@resend.dev.',
    ],
    link: { url: 'https://resend.com/domains', label: 'Resend Domains' },
  },

  // Ads
  meta_ads_accountId: {
    title: 'Meta Ad Account ID',
    steps: [
      'Go to business.facebook.com/adsmanager.',
      'Check the account dropdown at top-left or URL bar for act_XXXXXXXXXX.',
      'Copy the numeric ID or act_ prefixed ID.',
    ],
    link: { url: 'https://adsmanager.facebook.com', label: 'Meta Ads Manager' },
  },
  google_ads_customerId: {
    title: 'Google Ads Customer ID',
    steps: [
      'Log into ads.google.com.',
      'Look at top-right corner next to your profile icon.',
      'Copy the 10-digit Customer ID in format: XXX-XXX-XXXX.',
    ],
    link: { url: 'https://ads.google.com', label: 'Google Ads Console' },
  },
};

function InfoTooltip({ fieldKey }: { fieldKey: string }) {
  const [open, setOpen] = useState(false);
  const tip = FIELD_TIPS[fieldKey];

  if (!tip) return null;

  return (
    <div className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-slate-400 hover:text-brand-600 transition-colors p-0.5 rounded-full hover:bg-brand-50"
        title="Where do I get this? Click for instructions"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80 p-3 bg-slate-900 text-white rounded-xl shadow-2xl text-[11px] leading-relaxed animate-in fade-in zoom-in-95 pointer-events-auto"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex items-center gap-1.5 font-semibold text-amber-300 pb-1.5 border-b border-slate-700">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{tip.title}</span>
          </div>
          <ol className="list-decimal pl-4 mt-2 space-y-1 text-slate-300">
            {tip.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
          {tip.link && (
            <div className="mt-2 pt-1.5 border-t border-slate-800 flex justify-end">
              <a
                href={tip.link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand-300 hover:text-brand-200 underline font-medium"
              >
                <span>{tip.link.label}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'messaging' | 'ads' | 'webhooks') || 'messaging';

  const [activeTab, setActiveTab] = useState<'messaging' | 'ads' | 'webhooks'>(initialTab);

  // Providers & Ads State
  const [providers, setProviders] = useState<CommunicationProviderItem[]>([]);
  const [adConnections, setAdConnections] = useState<AdPlatformConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [activeProviderModal, setActiveProviderModal] = useState<ProviderType | null>(null);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  // Provider Form State
  const [providerForm, setProviderForm] = useState<{
    displayName: string;
    configuration: Record<string, any>;
    isDefault: boolean;
  }>({
    displayName: '',
    configuration: {},
    isDefault: false,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Ad Form State
  const [adPlatform, setAdPlatform] = useState<AdPlatform>('meta');
  const [adAccountName, setAdAccountName] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [adAccessToken, setAdAccessToken] = useState('');
  const [isAdSubmitting, setIsAdSubmitting] = useState(false);

  // Copy status
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [provList, adList] = await Promise.all([
        getCommunicationProvidersApi().catch(() => []),
        getAdConnectionsApi().then((r) => r.data || []).catch(() => []),
      ]);
      setProviders(provList);
      setAdConnections(adList);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Open Provider Configuration Modal
  const openProviderModal = (type: ProviderType) => {
    const existing = providers.find((p) => p.providerType === type);
    setActiveProviderModal(type);
    setTestResult(null);

    if (existing) {
      setProviderForm({
        displayName: existing.displayName,
        configuration: { ...existing.configuration },
        isDefault: existing.isDefault,
      });
    } else {
      let defaultName = '';
      switch (type) {
        case 'whatsapp':
          defaultName = 'WhatsApp Cloud API';
          break;
        case 'meta_instagram':
          defaultName = 'Instagram Direct Messenger';
          break;
        case 'meta_messenger':
          defaultName = 'Facebook Page Messenger';
          break;
        case 'twilio':
          defaultName = 'Twilio SMS & Messaging';
          break;
        case 'resend':
          defaultName = 'Resend Transactional Email';
          break;
        default:
          defaultName = `${type} Provider`;
      }
      setProviderForm({
        displayName: defaultName,
        configuration: {},
        isDefault: false,
      });
    }
  };

  const handleTestProvider = async () => {
    if (!activeProviderModal) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testCommunicationProviderApi({
        providerType: activeProviderModal,
        configuration: providerForm.configuration,
      });
      setTestResult({
        success: true,
        message: res.message || 'Parameters validated and verified successfully!',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Verification test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProviderModal) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveCommunicationProviderApi({
        providerType: activeProviderModal,
        displayName: providerForm.displayName.trim() || activeProviderModal,
        configuration: providerForm.configuration,
        isDefault: providerForm.isDefault,
        status: 'active',
      });
      setSuccess(`${providerForm.displayName || activeProviderModal} configuration saved successfully!`);
      setActiveProviderModal(null);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const handleDeleteProvider = async (providerId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? Incoming and outbound messages on this channel will halt.`)) return;
    try {
      await deleteCommunicationProviderApi(providerId);
      setSuccess(`${name} removed successfully.`);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove provider');
    } finally {
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const handleConnectAdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdSubmitting(true);
    setError(null);
    try {
      await createAdConnectionApi({
        platform: adPlatform,
        accountName: adAccountName.trim(),
        accountId: adAccountId.trim(),
        accessToken: adAccessToken.trim(),
      });
      setIsAdModalOpen(false);
      setAdAccountName('');
      setAdAccountId('');
      setAdAccessToken('');
      setSuccess(`${adPlatform.toUpperCase()} Ads connection authorized successfully!`);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to connect ad account');
    } finally {
      setIsAdSubmitting(false);
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const webhookBase =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/v1/conversations/webhook`
      : 'https://api.flumenx.com/api/v1/conversations/webhook';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-800 text-white shadow-xs">
              <Zap className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              API & Channel Integrations Hub
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Centralized management for WhatsApp Cloud API, Instagram, Facebook Messenger, SMS, Resend Email, and Ads.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsWebhookModalOpen(true)}
            className="flex items-center gap-1.5 text-xs border-slate-300"
          >
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            Webhook Endpoints
          </Button>

          <Link href="/client/inbox">
            <Button
              size="sm"
              className="bg-brand-800 hover:bg-brand-700 text-white flex items-center gap-1.5 text-xs shadow-xs"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Open Unified Inbox
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Alerts */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('messaging')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'messaging'
              ? 'bg-brand-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Messaging & Inbox Channels
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'messaging' ? 'bg-brand-900/60 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {providers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ads')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'ads'
              ? 'bg-brand-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Advertising & Lead Gen
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'ads' ? 'bg-brand-900/60 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {adConnections.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'webhooks'
              ? 'bg-brand-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Radio className="w-4 h-4" />
          Webhook & Callback URLs
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: MESSAGING & INBOX CHANNELS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'messaging' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Configured Communication Channels</h2>
              <p className="text-xs text-slate-500">
                Incoming conversations will land in your Unified Inbox, and outgoing replies will route through these credentials.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. WhatsApp Cloud API */}
            {(() => {
              const prov = providers.find((p) => p.providerType === 'whatsapp');
              return (
                <Card className="border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <Badge variant={prov ? (prov.status === 'active' ? 'success' : 'danger') : 'neutral'}>
                        {prov ? (prov.isDefault ? 'Default Active' : 'Connected') : 'Not Configured'}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">WhatsApp Cloud API</h3>
                        <InfoTooltip fieldKey="whatsapp_phoneNumberId" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Official Meta WhatsApp Business API for instant two-way chat, automation, and template messages.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Phone Number ID:</span>
                        <span className="font-mono font-medium">
                          {prov?.configuration?.phoneNumberId || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Access Token:</span>
                        <span className="font-mono text-slate-500">
                          {prov?.configuration?.accessToken ? '•••• Configured' : 'Missing'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Graph API v19.0</span>
                      <div className="flex items-center gap-1.5">
                        {prov && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProvider(prov._id, 'WhatsApp Cloud API')}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50"
                            title="Disconnect WhatsApp"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProviderModal('whatsapp')}
                          className="text-xs h-8 border-slate-300"
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1" />
                          {prov ? 'Edit Settings' : 'Configure'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* 2. Instagram Direct */}
            {(() => {
              const prov = providers.find((p) => p.providerType === 'meta_instagram');
              return (
                <Card className="border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <Badge variant={prov ? (prov.status === 'active' ? 'success' : 'danger') : 'neutral'}>
                        {prov ? (prov.isDefault ? 'Default Active' : 'Connected') : 'Not Configured'}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">Instagram Direct</h3>
                        <InfoTooltip fieldKey="instagram_accountId" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Direct message sync for business profiles, story replies, and customer DM responses.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Instagram Account:</span>
                        <span className="font-mono font-medium truncate max-w-[130px]">
                          {prov?.configuration?.instagramAccountId || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Page Access Token:</span>
                        <span className="font-mono text-slate-500">
                          {prov?.configuration?.pageAccessToken ? '•••• Configured' : 'Missing'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Instagram Messaging API</span>
                      <div className="flex items-center gap-1.5">
                        {prov && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProvider(prov._id, 'Instagram Direct')}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50"
                            title="Disconnect Instagram"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProviderModal('meta_instagram')}
                          className="text-xs h-8 border-slate-300"
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1" />
                          {prov ? 'Edit Settings' : 'Configure'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* 3. Facebook Messenger */}
            {(() => {
              const prov = providers.find((p) => p.providerType === 'meta_messenger');
              return (
                <Card className="border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <Badge variant={prov ? (prov.status === 'active' ? 'success' : 'danger') : 'neutral'}>
                        {prov ? (prov.isDefault ? 'Default Active' : 'Connected') : 'Not Configured'}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">Facebook Messenger</h3>
                        <InfoTooltip fieldKey="messenger_pageId" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Connect Facebook Page inbox to respond to live customer inquiries and ad click-to-messenger leads.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Page ID:</span>
                        <span className="font-mono font-medium">
                          {prov?.configuration?.pageId || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Page Token:</span>
                        <span className="font-mono text-slate-500">
                          {prov?.configuration?.pageAccessToken ? '•••• Configured' : 'Missing'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Messenger Platform</span>
                      <div className="flex items-center gap-1.5">
                        {prov && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProvider(prov._id, 'Facebook Messenger')}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50"
                            title="Disconnect Messenger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProviderModal('meta_messenger')}
                          className="text-xs h-8 border-slate-300"
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1" />
                          {prov ? 'Edit Settings' : 'Configure'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* 4. Twilio SMS */}
            {(() => {
              const prov = providers.find((p) => p.providerType === 'twilio');
              return (
                <Card className="border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <Badge variant={prov ? (prov.status === 'active' ? 'success' : 'danger') : 'neutral'}>
                        {prov ? (prov.isDefault ? 'Default Active' : 'Connected') : 'Not Configured'}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">Twilio SMS / MMS</h3>
                        <InfoTooltip fieldKey="twilio_accountSid" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Global cellular SMS and MMS delivery for 1-on-1 lead messaging and automated notifications.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account SID:</span>
                        <span className="font-mono font-medium truncate max-w-[130px]">
                          {prov?.configuration?.accountSid || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">From Phone:</span>
                        <span className="font-mono text-slate-700">
                          {prov?.configuration?.fromNumber || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Twilio Programmable Messaging</span>
                      <div className="flex items-center gap-1.5">
                        {prov && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProvider(prov._id, 'Twilio SMS')}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50"
                            title="Disconnect Twilio"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProviderModal('twilio')}
                          className="text-xs h-8 border-slate-300"
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1" />
                          {prov ? 'Edit Settings' : 'Configure'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* 5. Resend / Email */}
            {(() => {
              const prov = providers.find((p) => p.providerType === 'resend');
              return (
                <Card className="border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                        <Mail className="w-5 h-5" />
                      </div>
                      <Badge variant={prov ? (prov.status === 'active' ? 'success' : 'danger') : 'neutral'}>
                        {prov ? (prov.isDefault ? 'Default Active' : 'Connected') : 'Not Configured'}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">Resend Email Gateway</h3>
                        <InfoTooltip fieldKey="resend_apiKey" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Modern email delivery infrastructure for branded client replies, notifications, and proposals.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sender Email:</span>
                        <span className="font-mono font-medium truncate max-w-[130px]">
                          {prov?.configuration?.fromEmail || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">API Key:</span>
                        <span className="font-mono text-slate-500">
                          {prov?.configuration?.apiKey ? '•••• Configured' : 'Missing'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Resend REST API</span>
                      <div className="flex items-center gap-1.5">
                        {prov && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProvider(prov._id, 'Resend Email')}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50"
                            title="Disconnect Resend"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProviderModal('resend')}
                          className="text-xs h-8 border-slate-300"
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1" />
                          {prov ? 'Edit Settings' : 'Configure'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: ADVERTISING & ATTRIBUTION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'ads' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Connected Advertising Accounts</h2>
              <p className="text-xs text-slate-500">
                Synchronize ad spend, click conversion metrics, and Meta instant lead generation forms.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAdModalOpen(true)}
              className="bg-brand-800 hover:bg-brand-700 text-white flex items-center gap-1.5 text-xs shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect Ad Account
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Meta Ads Card */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base border border-blue-100">
                      f
                    </div>
                    <Badge variant={adConnections.some((c) => c.platform === 'meta' && c.status === 'active') ? 'success' : 'neutral'}>
                      {adConnections.some((c) => c.platform === 'meta' && c.status === 'active') ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 mt-3">
                    <h3 className="font-bold text-slate-900 text-sm">Meta Ads & Lead Gen</h3>
                    <InfoTooltip fieldKey="meta_ads_accountId" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Pulls Facebook and Instagram campaigns, ad set spend, impressions, and automatically ingests instant lead form submissions into Leads CRM.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Marketing API v19.0</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdPlatform('meta');
                      setIsAdModalOpen(true);
                    }}
                    className="text-xs border-slate-300"
                  >
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Google Ads Card */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base border border-amber-100">
                      G
                    </div>
                    <Badge variant={adConnections.some((c) => c.platform === 'google' && c.status === 'active') ? 'success' : 'neutral'}>
                      {adConnections.some((c) => c.platform === 'google' && c.status === 'active') ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 mt-3">
                    <h3 className="font-bold text-slate-900 text-sm">Google Ads Manager</h3>
                    <InfoTooltip fieldKey="google_ads_customerId" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Synchronize Search, Display, and Performance Max ad clicks, cost-per-acquisition (CPA), and keyword telemetry.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Google Ads API v16</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdPlatform('google');
                      setIsAdModalOpen(true);
                    }}
                    className="text-xs border-slate-300"
                  >
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Ad Accounts Table */}
          <Card className="border-slate-200 shadow-xs overflow-hidden bg-white">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Connected Ad Accounts ({adConnections.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAll}
                disabled={loading}
                className="flex items-center gap-1 text-xs border-slate-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Check Status
              </Button>
            </div>

            {adConnections.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Megaphone className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No ad accounts connected yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <th className="py-3 px-4">Platform</th>
                      <th className="py-3 px-4">Account Name</th>
                      <th className="py-3 px-4">Account ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Last Synced</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adConnections.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${
                              c.platform === 'meta'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {c.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {c.accountName}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {c.accountId}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge variant={c.status === 'active' ? 'success' : 'danger'}>
                            {c.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : 'Pending sync'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await syncAdConnectionApi(c._id);
                                setSuccess('Ad account metrics synced.');
                                await loadAll();
                              } catch (e: any) {
                                setError(e.message || 'Sync failed');
                              }
                            }}
                            className="h-7 text-[11px] px-2.5"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Sync
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!confirm(`Disconnect ${c.accountName}?`)) return;
                              await revokeAdConnectionApi(c._id);
                              await loadAll();
                            }}
                            className="h-7 text-[11px] px-2.5 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Disconnect
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: WEBHOOKS & CALLBACKS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Webhook Endpoints & Ingestion Gateway</h2>
            <p className="text-xs text-slate-500">
              Provide these endpoints to Meta Developer App, Twilio Console, or custom landing pages to ingest real-time messages and leads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Conversations & Messages Inbound Webhook */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-brand-800 font-bold text-sm">
                  <MessageSquare className="w-4 h-4" />
                  <span>Inbound Messaging Webhook (POST & GET)</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Configured in Meta App (WhatsApp/Messenger/Instagram) and Twilio. Handles incoming messages, delivery receipts, and verification challenges.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Callback URL:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookBase}
                        className="flex-1 p-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700 select-all"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(webhookBase, 'wa_webhook')}
                        className="shrink-0 h-8"
                      >
                        {copiedKey === 'wa_webhook' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Meta Verify Token:
                      </label>
                      <InfoTooltip fieldKey="whatsapp_verifyToken" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value="flumenx_conect_verify_token_secure"
                        className="flex-1 p-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard('flumenx_conect_verify_token_secure', 'verify_token')}
                        className="shrink-0 h-8"
                      >
                        {copiedKey === 'verify_token' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leads Ingestion Webhook */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <Radio className="w-4 h-4" />
                  <span>Leads Intake Webhook (POST)</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Connect Elementor Forms, WordPress, Zapier, or custom landing pages directly into Leads CRM.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Intake URL:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={typeof window !== 'undefined' ? `${window.location.origin}/api/v1/client/leads/intake` : 'https://api.flumenx.com/api/v1/client/leads/intake'}
                        className="flex-1 p-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700 select-all"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(typeof window !== 'undefined' ? `${window.location.origin}/api/v1/client/leads/intake` : '', 'leads_webhook')}
                        className="shrink-0 h-8"
                      >
                        {copiedKey === 'leads_webhook' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">Accepted JSON Payload Keys:</p>
                    <p className="font-mono text-[10px] text-slate-500">
                      firstName, lastName, email, phone, company, source, notes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Provider Configuration with Interactive Tips */}
      {/* ------------------------------------------------------------- */}
      {activeProviderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-800">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Configure {activeProviderModal === 'whatsapp' ? 'WhatsApp Cloud API' :
                              activeProviderModal === 'meta_instagram' ? 'Instagram Direct' :
                              activeProviderModal === 'meta_messenger' ? 'Facebook Messenger' :
                              activeProviderModal === 'twilio' ? 'Twilio SMS' : 'Resend Email'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Click the <Info className="w-3 h-3 inline text-slate-400" /> icons next to any field for instructions on where to get keys.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveProviderModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProvider} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Display Label:</label>
                <input
                  type="text"
                  value={providerForm.displayName}
                  onChange={(e) => setProviderForm({ ...providerForm, displayName: e.target.value })}
                  placeholder="e.g. Primary WhatsApp Number"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Specific fields for WHATSAPP */}
              {activeProviderModal === 'whatsapp' && (
                <>
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Phone Number ID:</label>
                      <InfoTooltip fieldKey="whatsapp_phoneNumberId" />
                    </div>
                    <input
                      type="text"
                      value={providerForm.configuration.phoneNumberId || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, phoneNumberId: e.target.value.trim() },
                        })
                      }
                      placeholder="e.g. 109283746592817"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">WhatsApp Business Account ID (WABA ID):</label>
                      <InfoTooltip fieldKey="whatsapp_wabaId" />
                    </div>
                    <input
                      type="text"
                      value={providerForm.configuration.wabaId || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, wabaId: e.target.value.trim() },
                        })
                      }
                      placeholder="e.g. 293847561029384"
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Permanent Access Token:</label>
                      <InfoTooltip fieldKey="whatsapp_accessToken" />
                    </div>
                    <input
                      type="password"
                      value={providerForm.configuration.accessToken || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, accessToken: e.target.value.trim() },
                        })
                      }
                      placeholder="EAABw..."
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </>
              )}

              {/* Specific fields for INSTAGRAM */}
              {activeProviderModal === 'meta_instagram' && (
                <>
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Instagram Business Account ID:</label>
                      <InfoTooltip fieldKey="instagram_accountId" />
                    </div>
                    <input
                      type="text"
                      value={providerForm.configuration.instagramAccountId || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, instagramAccountId: e.target.value.trim() },
                        })
                      }
                      placeholder="e.g. 17841400123456789"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Page Access Token:</label>
                      <InfoTooltip fieldKey="instagram_pageAccessToken" />
                    </div>
                    <input
                      type="password"
                      value={providerForm.configuration.pageAccessToken || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, pageAccessToken: e.target.value.trim() },
                        })
                      }
                      placeholder="EAAG..."
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </>
              )}

              {/* Specific fields for FACEBOOK MESSENGER */}
              {activeProviderModal === 'meta_messenger' && (
                <>
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Facebook Page ID:</label>
                      <InfoTooltip fieldKey="messenger_pageId" />
                    </div>
                    <input
                      type="text"
                      value={providerForm.configuration.pageId || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, pageId: e.target.value.trim() },
                        })
                      }
                      placeholder="e.g. 104829104857291"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Page Access Token:</label>
                      <InfoTooltip fieldKey="messenger_pageAccessToken" />
                    </div>
                    <input
                      type="password"
                      value={providerForm.configuration.pageAccessToken || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, pageAccessToken: e.target.value.trim() },
                        })
                      }
                      placeholder="EAAG..."
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </>
              )}

              {/* Specific fields for TWILIO */}
              {activeProviderModal === 'twilio' && (
                <>
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Twilio Account SID:</label>
                      <InfoTooltip fieldKey="twilio_accountSid" />
                    </div>
                    <input
                      type="text"
                      value={providerForm.configuration.accountSid || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, accountSid: e.target.value.trim() },
                        })
                      }
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Auth Token:</label>
                      <InfoTooltip fieldKey="twilio_authToken" />
                    </div>
                    <input
                      type="password"
                      value={providerForm.configuration.authToken || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, authToken: e.target.value.trim() },
                        })
                      }
                      placeholder="32 character auth token"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Sender Phone Number:</label>
                      <InfoTooltip fieldKey="twilio_fromNumber" />
                    </div>
                    <input
                      type="text"
                      value={providerForm.configuration.fromNumber || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, fromNumber: e.target.value.trim() },
                        })
                      }
                      placeholder="+14155552671"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </>
              )}

              {/* Specific fields for RESEND */}
              {activeProviderModal === 'resend' && (
                <>
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">Resend API Key:</label>
                      <InfoTooltip fieldKey="resend_apiKey" />
                    </div>
                    <input
                      type="password"
                      value={providerForm.configuration.apiKey || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, apiKey: e.target.value.trim() },
                        })
                      }
                      placeholder="re_123456789..."
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center mb-1">
                      <label className="font-semibold text-slate-700">From Email Address:</label>
                      <InfoTooltip fieldKey="resend_fromEmail" />
                    </div>
                    <input
                      type="email"
                      value={providerForm.configuration.fromEmail || ''}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          configuration: { ...providerForm.configuration, fromEmail: e.target.value.trim() },
                        })
                      }
                      placeholder="notifications@yourdomain.com"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </>
              )}

              {/* Default Channel Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefaultChannel"
                  checked={providerForm.isDefault}
                  onChange={(e) => setProviderForm({ ...providerForm, isDefault: e.target.checked })}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="isDefaultChannel" className="text-slate-700 font-medium cursor-pointer">
                  Set as Primary Outbound Channel for this workspace
                </label>
              </div>

              {/* Test Connection Output */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestProvider}
                  disabled={isTesting}
                  className="text-xs border-slate-300"
                >
                  {isTesting ? 'Validating...' : 'Test Connection'}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveProviderModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSaving}
                    className="bg-brand-800 hover:bg-brand-700 text-white"
                  >
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Connect Ad Platform */}
      {/* ------------------------------------------------------------- */}
      {isAdModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-800">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Connect Ad Account</h3>
                  <p className="text-[11px] text-slate-400">Sync campaigns, attribution & lead ads</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConnectAdSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Platform:</label>
                <select
                  value={adPlatform}
                  onChange={(e) => setAdPlatform(e.target.value as AdPlatform)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50 font-medium"
                >
                  <option value="meta">Meta Ads (Facebook & Instagram Lead Gen)</option>
                  <option value="google">Google Ads (Search & Performance Max)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Display Name:</label>
                <input
                  type="text"
                  value={adAccountName}
                  onChange={(e) => setAdAccountName(e.target.value)}
                  placeholder="e.g. Acme Primary Meta Ads"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <div className="flex items-center mb-1">
                  <label className="font-semibold text-slate-700">
                    {adPlatform === 'meta' ? 'Meta Ad Account ID:' : 'Google Customer ID:'}
                  </label>
                  <InfoTooltip fieldKey={adPlatform === 'meta' ? 'meta_ads_accountId' : 'google_ads_customerId'} />
                </div>
                <input
                  type="text"
                  value={adAccountId}
                  onChange={(e) => setAdAccountId(e.target.value)}
                  placeholder={adPlatform === 'meta' ? 'act_1234567890' : '123-456-7890'}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">API Access Token:</label>
                <input
                  type="password"
                  value={adAccessToken}
                  onChange={(e) => setAdAccessToken(e.target.value)}
                  placeholder="System user token or OAuth token"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAdSubmitting || !adAccountName || !adAccountId || !adAccessToken}
                  className="bg-brand-800 hover:bg-brand-700 text-white"
                >
                  {isAdSubmitting ? 'Connecting...' : 'Authorize & Connect'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Webhook Gateway Drawer */}
      {/* ------------------------------------------------------------- */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Radio className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Webhook Ingestion URLs</h3>
                  <p className="text-[11px] text-slate-400">Target endpoints for lead forms & messaging</p>
                </div>
              </div>
              <button
                onClick={() => setIsWebhookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Unified Messaging Webhook (WhatsApp / Messenger / Twilio):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookBase}
                    className="flex-1 p-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700 select-all"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(webhookBase, 'drawer_msg')}
                    className="shrink-0"
                  >
                    {copiedKey === 'drawer_msg' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center mb-1">
                  <label className="font-semibold text-slate-700">Meta Webhook Verify Token:</label>
                  <InfoTooltip fieldKey="whatsapp_verifyToken" />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="flumenx_conect_verify_token_secure"
                    className="flex-1 p-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700 select-all"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard('flumenx_conect_verify_token_secure', 'drawer_verify')}
                    className="shrink-0"
                  >
                    {copiedKey === 'drawer_verify' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Encryption & Security:</p>
                <p>
                  Payloads are validated with SHA256 HMAC signatures or Bearer tokens. Replay attacks are rejected using timestamp drift detection (&lt;5m).
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setIsWebhookModalOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientIntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading integrations...</div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
