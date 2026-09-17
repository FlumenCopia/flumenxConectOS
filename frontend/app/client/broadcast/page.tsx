'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  Send,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Eye,
  Paperclip,
  Check,
  ChevronRight,
  FileUp,
  Radio,
  Smartphone,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Users,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  BroadcastChannel,
  BroadcastCampaignItem,
  BroadcastAttachment,
  getBroadcastsApi,
  createBroadcastApi,
  uploadBroadcastAttachmentApi,
  getBroadcastByIdApi,
} from '@/lib/broadcast';
import { useAuth } from '@/hooks/useAuth';

interface ParsedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  isValid: boolean;
  validationError?: string;
  customFields: Record<string, any>;
}

export default function BroadcastPage() {
  const { activeClient } = useAuth();
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  // Form State
  const [campaignName, setCampaignName] = useState('Festive Promotion & Catalog Blast');
  const [channel, setChannel] = useState<BroadcastChannel>('whatsapp');
  const [messageBody, setMessageBody] = useState(
    'Hi {{Name}}, greeting from Acme Digital Media! 🎉\n\nWe are excited to share our latest product catalog and special discounts with you. Please review the attached document for exclusive deals.\n\nReply to this message anytime to chat with our executive!'
  );

  // File & Contact List State
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [sheetColumns, setSheetColumns] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState<string>('');
  const [nameColumn, setNameColumn] = useState<string>('');
  const [emailColumn, setEmailColumn] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [deduplicate, setDeduplicate] = useState(true);
  const [filterValidOnly, setFilterValidOnly] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [previewPage, setPreviewPage] = useState(1);
  const pageSize = 8;

  // Media Attachment State
  const [attachment, setAttachment] = useState<BroadcastAttachment | null>(null);
  const [attachmentLocalPreview, setAttachmentLocalPreview] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Dispatch & Modal State
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<BroadcastCampaignItem | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);

  // History State
  const [campaigns, setCampaigns] = useState<BroadcastCampaignItem[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<BroadcastCampaignItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch campaigns for history tab
  const fetchCampaigns = async () => {
    try {
      setIsLoadingCampaigns(true);
      const res = await getBroadcastsApi(1, 50);
      setCampaigns(res.campaigns || []);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchCampaigns();
    }
  }, [activeTab]);

  // Load sample default contacts if none uploaded
  useEffect(() => {
    if (parsedContacts.length === 0 && !uploadedFileName) {
      const defaultSamples: ParsedContact[] = [
        {
          id: 'demo-1',
          name: 'Rajesh Sharma',
          phone: '+919820123456',
          email: 'rajesh@example.com',
          isValid: true,
          customFields: { City: 'Mumbai' },
        },
        {
          id: 'demo-2',
          name: 'Ananya Iyer',
          phone: '+919845098765',
          email: 'ananya@example.com',
          isValid: true,
          customFields: { City: 'Bengaluru' },
        },
        {
          id: 'demo-3',
          name: 'Vikram Malhotra',
          phone: '+919811223344',
          email: 'vikram@example.com',
          isValid: true,
          customFields: { City: 'Delhi' },
        },
      ];
      setParsedContacts(defaultSamples);
      setUploadedFileName('Demo_Sample_Recipients.xlsx');
      setSheetColumns(['Name', 'Phone', 'Email', 'City']);
      setNameColumn('Name');
      setPhoneColumn('Phone');
      setEmailColumn('Email');
    }
  }, []);

  // Handle Excel/CSV file upload & SheetJS parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!json || json.length === 0) {
          alert('The uploaded Excel sheet contains no rows.');
          return;
        }

        const cols = Object.keys(json[0] || {});
        setSheetColumns(cols);
        setRawRows(json);

        // Auto-detect column mappings
        const detectedPhoneCol =
          cols.find((c) => /phone|mobile|contact|cell|number|whatsapp/i.test(c)) || cols[0];
        const detectedNameCol =
          cols.find((c) => /name|customer|client|lead|person/i.test(c)) || cols[1] || cols[0];
        const detectedEmailCol = cols.find((c) => /email|mail/i.test(c)) || '';

        setPhoneColumn(detectedPhoneCol);
        setNameColumn(detectedNameCol);
        setEmailColumn(detectedEmailCol);

        processRows(json, detectedPhoneCol, detectedNameCol, detectedEmailCol, deduplicate);
      } catch (err: any) {
        console.error('Error reading Excel file:', err);
        alert('Could not parse Excel or CSV file. Please make sure it is a valid format.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Process rows into clean ParsedContacts
  const processRows = (
    rows: any[],
    pCol: string,
    nCol: string,
    eCol: string,
    isDedupe: boolean
  ) => {
    const seenPhones = new Set<string>();
    const contacts: ParsedContact[] = [];

    rows.forEach((row, idx) => {
      const rawPhone = String(row[pCol] || '').trim();
      const rawName = String(row[nCol] || '').trim();
      const rawEmail = eCol ? String(row[eCol] || '').trim() : undefined;

      // Clean phone number: remove non-digits (allow + at start)
      let cleanedPhone = rawPhone.replace(/[^\d+]/g, '');
      let isValid = true;
      let error = '';

      if (!cleanedPhone || cleanedPhone.replace(/\D/g, '').length < 7) {
        isValid = false;
        error = 'Invalid phone number (too short)';
      }

      if (isDedupe && seenPhones.has(cleanedPhone)) {
        isValid = false;
        error = 'Duplicate mobile number';
      }

      if (isValid && cleanedPhone) {
        seenPhones.add(cleanedPhone);
      }

      const customFields: Record<string, any> = {};
      Object.keys(row).forEach((k) => {
        if (k !== pCol && k !== nCol && k !== eCol) {
          customFields[k] = row[k];
        }
      });

      contacts.push({
        id: `row-${idx}`,
        name: rawName || 'Customer',
        phone: cleanedPhone || rawPhone,
        email: rawEmail,
        isValid,
        validationError: error,
        customFields,
      });
    });

    setParsedContacts(contacts);
    setPreviewPage(1);
  };

  // Re-process if column mapping or deduplicate toggle changes
  useEffect(() => {
    if (rawRows.length > 0 && phoneColumn) {
      processRows(rawRows, phoneColumn, nameColumn, emailColumn, deduplicate);
    }
  }, [phoneColumn, nameColumn, emailColumn, deduplicate]);

  // Handle Media Attachment (Image or PDF)
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaError(null);
    setIsUploadingMedia(true);

    // Max 25MB check
    if (file.size > 25 * 1024 * 1024) {
      setMediaError('File size exceeds 25 MB limit.');
      setIsUploadingMedia(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const base64Data = evt.target?.result as string;
        setAttachmentLocalPreview(base64Data);

        // Upload to backend API
        const uploaded = await uploadBroadcastAttachmentApi({
          filename: file.name,
          base64Data,
          mimeType: file.type || 'application/octet-stream',
        });

        setAttachment({
          name: uploaded.name,
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          size: uploaded.size || file.size,
          fileType: file.type.includes('image')
            ? 'image'
            : file.type.includes('pdf')
            ? 'pdf'
            : 'document',
        });
      } catch (err: any) {
        console.error('Failed to upload media:', err);
        setMediaError(err.response?.data?.message || 'Failed to upload media file to server');
      } finally {
        setIsUploadingMedia(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentLocalPreview(null);
    setMediaError(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
  };

  // Sample Excel download generator
  const downloadSampleExcel = () => {
    const sampleRows = [
      {
        'Full Name': 'Aarav Patel',
        'Mobile Number': '+919876543210',
        Email: 'aarav@example.com',
        City: 'Mumbai',
        Plan: 'VIP Premium',
      },
      {
        'Full Name': 'Priya Sharma',
        'Mobile Number': '+919823456789',
        Email: 'priya@example.com',
        City: 'Bengaluru',
        Plan: 'Enterprise',
      },
      {
        'Full Name': 'Rohan Mehta',
        'Mobile Number': '+919123456780',
        Email: 'rohan@example.com',
        City: 'Delhi',
        Plan: 'Growth',
      },
      {
        'Full Name': 'Kavita Verma',
        'Mobile Number': '+919890123456',
        Email: 'kavita@example.com',
        City: 'Hyderabad',
        Plan: 'Starter',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Broadcast_Recipients');
    XLSX.writeFile(wb, 'flumenx_broadcast_mobile_sample.xlsx');
  };

  // Insert variable into message textarea
  const insertVariable = (variableKey: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const current = messageBody;
    const updated = current.substring(0, start) + `{{${variableKey}}}` + current.substring(end);
    setMessageBody(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + variableKey.length + 4,
          start + variableKey.length + 4
        );
      }
    }, 50);
  };

  // Stats calculation
  const validContacts = useMemo(() => parsedContacts.filter((c) => c.isValid), [parsedContacts]);
  const invalidContacts = useMemo(() => parsedContacts.filter((c) => !c.isValid), [parsedContacts]);

  // Filtered preview contacts
  const filteredContacts = useMemo(() => {
    return parsedContacts.filter((c) => {
      if (filterValidOnly && !c.isValid) return false;
      if (!searchFilter) return true;
      const q = searchFilter.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    });
  }, [parsedContacts, filterValidOnly, searchFilter]);

  const totalPages = Math.ceil(filteredContacts.length / pageSize) || 1;
  const paginatedContacts = filteredContacts.slice(
    (previewPage - 1) * pageSize,
    previewPage * pageSize
  );

  // Remove individual contact
  const removeContact = (id: string) => {
    setParsedContacts((prev) => prev.filter((c) => c.id !== id));
  };

  // Launch Broadcast Blast
  const handleLaunchBroadcast = async () => {
    if (validContacts.length === 0) {
      alert('Please upload or provide at least one valid mobile number.');
      return;
    }
    if (!messageBody.trim()) {
      alert('Please enter a message body for the broadcast.');
      return;
    }

    setIsDispatching(true);
    setDispatchError(null);
    setShowProgressModal(true);

    try {
      const payload = {
        name: campaignName.trim() || `Broadcast Blast - ${new Date().toLocaleDateString()}`,
        channel,
        messageBody: messageBody.trim(),
        attachment: attachment || undefined,
        recipients: validContacts.map((c) => ({
          name: c.name,
          phone: c.phone,
          email: c.email,
          customFields: c.customFields,
        })),
      };

      const result = await createBroadcastApi(payload);
      setDispatchSuccess(result);
    } catch (err: any) {
      console.error('Broadcast dispatch error:', err);
      setDispatchError(
        err.response?.data?.message || err.message || 'Failed to dispatch broadcast campaign'
      );
    } finally {
      setIsDispatching(false);
    }
  };

  // Inspect Campaign Details in History
  const handleInspectCampaign = async (campaignId: string) => {
    try {
      setIsLoadingDetails(true);
      const details = await getBroadcastByIdApi(campaignId);
      setSelectedCampaign(details);
    } catch (err) {
      console.error('Failed to load campaign details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Preview message with first contact's data
  const sampleContact = validContacts[0] || { name: 'Rajesh Sharma', phone: '+919820123456' };
  const previewPersonalizedText = messageBody
    .replace(/\{\{Name\}\}/gi, sampleContact.name || 'Valued Customer')
    .replace(/\{\{Phone\}\}/gi, sampleContact.phone || '+91 98201 23456')
    .replace(/\{\{Email\}\}/gi, sampleContact.email || 'customer@example.com');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-900/40 shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Broadcast Campaign Blast
                <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 text-xs px-2 py-0.5">
                  Multi-Channel
                </Badge>
              </h1>
              <p className="text-sm text-slate-300">
                Upload contact sheets (Excel / CSV), attach rich media (Images, PDFs, Brochures), and blast personalized messages at scale.
              </p>
            </div>
          </div>
        </div>

        {/* Action Tabs & Sample Download */}
        <div className="flex items-center gap-2 relative z-10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadSampleExcel}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 gap-2 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Sample Excel
          </Button>

          <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 flex">
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'compose'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              New Blast
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Campaign History
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: COMPOSE BROADCAST */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Main Section (8 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Upload Excel/CSV */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-base font-semibold text-slate-800">
                    Upload Mobile Numbers (Excel or CSV)
                  </h2>
                </div>
                {uploadedFileName && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {uploadedFileName}
                  </Badge>
                )}
              </div>

              <CardContent className="p-5 space-y-4">
                {/* Upload Dropzone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-xl p-6 text-center cursor-pointer transition-all duration-200 group"
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600 flex items-center justify-center transition-all">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    Click to browse or drag & drop contact spreadsheet
                  </p>
                  <p className="text-xs text-slate-500">
                    Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
                  </p>
                </div>

                {/* Column Mapping Selector */}
                {sheetColumns.length > 0 && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Column Mapping
                      </span>
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={deduplicate}
                          onChange={(e) => setDeduplicate(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Auto-remove duplicate phone numbers</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Mobile Number *
                        </label>
                        <select
                          value={phoneColumn}
                          onChange={(e) => setPhoneColumn(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                        >
                          {sheetColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Recipient Name
                        </label>
                        <select
                          value={nameColumn}
                          onChange={(e) => setNameColumn(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- None / Default --</option>
                          {sheetColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Email (Optional)
                        </label>
                        <select
                          value={emailColumn}
                          onChange={(e) => setEmailColumn(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- None / Ignored --</option>
                          {sheetColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recipient Stats Counter & Preview Table */}
                {parsedContacts.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-slate-700">
                          Total: <strong className="text-indigo-600">{parsedContacts.length}</strong>
                        </span>
                        <span className="text-emerald-700 font-medium">
                          ✓ {validContacts.length} Valid
                        </span>
                        {invalidContacts.length > 0 && (
                          <span className="text-rose-600 font-medium">
                            ✗ {invalidContacts.length} Invalid/Duplicate
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchFilter}
                            onChange={(e) => {
                              setSearchFilter(e.target.value);
                              setPreviewPage(1);
                            }}
                            className="text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setFilterValidOnly(!filterValidOnly)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                            filterValidOnly
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {filterValidOnly ? 'Valid Only' : 'Show All'}
                        </button>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Name</th>
                              <th className="py-2.5 px-3">Phone / Mobile</th>
                              <th className="py-2.5 px-3">City / Extra</th>
                              <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedContacts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-6 text-center text-slate-400">
                                  No recipients match search criteria
                                </td>
                              </tr>
                            ) : (
                              paginatedContacts.map((contact) => (
                                <tr key={contact.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-2 px-3">
                                    {contact.isValid ? (
                                      <span className="inline-flex items-center text-emerald-600 gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center text-rose-500 gap-1 font-medium"
                                        title={contact.validationError}
                                      >
                                        <XCircle className="w-3.5 h-3.5" /> {contact.validationError || 'Invalid'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-medium text-slate-800">
                                    {contact.name || 'Customer'}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 font-mono">
                                    {contact.phone}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">
                                    {contact.customFields?.City || contact.email || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeContact(contact.id)}
                                      className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                                      title="Remove from list"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination footer */}
                      {totalPages > 1 && (
                        <div className="py-2 px-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span>
                            Page {previewPage} of {totalPages}
                          </span>
                          <div className="flex gap-1">
                            <button
                              disabled={previewPage <= 1}
                              onClick={() => setPreviewPage((p) => p - 1)}
                              className="px-2 py-0.5 border border-slate-200 rounded bg-white disabled:opacity-40"
                            >
                              Prev
                            </button>
                            <button
                              disabled={previewPage >= totalPages}
                              onClick={() => setPreviewPage((p) => p + 1)}
                              className="px-2 py-0.5 border border-slate-200 rounded bg-white disabled:opacity-40"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Channel & Message Content */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-base font-semibold text-slate-800">
                    Delivery Channel & Message Blast
                  </h2>
                </div>
              </div>

              <CardContent className="p-5 space-y-5">
                {/* Campaign Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Campaign Blast Name *
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Diwali Offer & Catalog Blast 2026"
                    className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Channel Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Dispatch Channel
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setChannel('whatsapp')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        channel === 'whatsapp'
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-emerald-600" />
                          WhatsApp Cloud
                        </span>
                        {channel === 'whatsapp' && (
                          <Check className="w-4 h-4 text-emerald-600 font-bold" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Supports text + rich media (Image, PDF brochure, catalog)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChannel('sms')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        channel === 'sms'
                          ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-indigo-600" />
                          Twilio SMS / MMS
                        </span>
                        {channel === 'sms' && (
                          <Check className="w-4 h-4 text-indigo-600 font-bold" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        High open rate mobile messaging with short link media
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChannel('email')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        channel === 'email'
                          ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                          <Send className="w-4 h-4 text-blue-600" />
                          Email Broadcast
                        </span>
                        {channel === 'email' && (
                          <Check className="w-4 h-4 text-blue-600 font-bold" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Long-form copy with file attachments sent to email
                      </p>
                    </button>
                  </div>
                </div>

                {/* Variable chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Message Body *
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400 mr-1">Insert dynamic tag:</span>
                      <button
                        type="button"
                        onClick={() => insertVariable('Name')}
                        className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-md transition-colors"
                      >
                        + {'{{Name}}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('Phone')}
                        className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-md transition-colors"
                      >
                        + {'{{Phone}}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('Email')}
                        className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-md transition-colors"
                      >
                        + {'{{Email}}'}
                      </button>
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    rows={6}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Type your message text here. Use {{Name}} to personalize..."
                    className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                    <span>Replies will be routed directly to your Unified Inbox.</span>
                    <span>{messageBody.length} characters</span>
                  </div>
                </div>

                {/* Step 3: Media Attachment Uploader (Image / PDF / Any) */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-600" />
                      Attach Media (Image, PDF Brochure, or Document)
                    </label>
                    <span className="text-[11px] text-slate-400">Optional · Max 25MB</span>
                  </div>

                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                    className="hidden"
                    onChange={handleMediaUpload}
                  />

                  {/* If no attachment yet */}
                  {!attachment && !isUploadingMedia && (
                    <div
                      onClick={() => mediaInputRef.current?.click()}
                      className="border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-xl p-4 text-center cursor-pointer transition-all flex items-center justify-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <UploadCloud className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold text-slate-700">
                          Click to select Image or PDF Document
                        </p>
                        <p className="text-[11px] text-slate-500">
                          PNG, JPG, WEBP, or PDF brochure to send with your message
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Uploading indicator */}
                  {isUploadingMedia && (
                    <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 flex items-center gap-3 animate-pulse">
                      <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                      <span className="text-xs font-medium text-indigo-900">
                        Uploading and preparing media attachment...
                      </span>
                    </div>
                  )}

                  {/* Attached Media Card Preview */}
                  {attachment && !isUploadingMedia && (
                    <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {attachment.fileType === 'image' && attachmentLocalPreview ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0">
                            <img
                              src={attachmentLocalPreview}
                              alt="Attachment preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : attachment.fileType === 'pdf' || attachment.name.endsWith('.pdf') ? (
                          <div className="w-12 h-12 rounded-lg bg-rose-100 text-rose-600 flex flex-col items-center justify-center shrink-0 border border-rose-200">
                            <FileText className="w-6 h-6" />
                            <span className="text-[9px] font-bold uppercase">PDF</span>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-slate-800 truncate max-w-xs">
                              {attachment.name}
                            </p>
                            <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200 text-[10px] px-1.5 py-0">
                              {attachment.fileType === 'image'
                                ? 'Image'
                                : attachment.name.endsWith('.pdf')
                                ? 'PDF Doc'
                                : 'Document'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {attachment.size
                              ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB`
                              : 'Ready for blast'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => mediaInputRef.current?.click()}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={removeAttachment}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                          title="Remove attachment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {mediaError && (
                    <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {mediaError}
                    </p>
                  )}
                </div>

                {/* Launch Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Ready to blast: <strong className="text-slate-800">{validContacts.length}</strong>{' '}
                    recipients via{' '}
                    <strong className="capitalize text-indigo-600">{channel}</strong>
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    onClick={handleLaunchBroadcast}
                    disabled={isDispatching || validContacts.length === 0}
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 px-6 font-semibold"
                  >
                    {isDispatching ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Launching Blast...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Broadcast Blast ({validContacts.length})
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Section: Interactive Smartphone / Chat Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                  Live Recipient Preview
                </span>
                <span className="text-[11px] text-slate-400">
                  Target: {sampleContact.name} ({sampleContact.phone})
                </span>
              </div>

              {/* Smartphone Frame */}
              <div className="w-full max-w-sm mx-auto bg-slate-900 rounded-[36px] p-3 shadow-2xl border-4 border-slate-800">
                {/* Speaker & camera notch */}
                <div className="w-32 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-slate-900 mr-2" />
                  <div className="w-10 h-1.5 bg-slate-700 rounded-full" />
                </div>

                {/* Smartphone Screen */}
                <div className="bg-[#EFEAE2] rounded-[28px] overflow-hidden min-h-[480px] flex flex-col justify-between border border-slate-700">
                  {/* WhatsApp/SMS Header */}
                  <div className="bg-[#075E54] text-white p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-xs text-white border border-emerald-500">
                        {activeClient?.clientName?.slice(0, 2).toUpperCase() || 'AD'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-tight flex items-center gap-1">
                          {activeClient?.clientName || 'Acme Digital Media'}
                          <span className="text-emerald-300 text-[10px]">✓</span>
                        </p>
                        <p className="text-[10px] text-emerald-100">Verified Business Account</p>
                      </div>
                    </div>
                  </div>

                  {/* Chat Area */}
                  <div className="p-3 flex-1 overflow-y-auto flex flex-col justify-end space-y-3 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]">
                    {/* Timestamp Pill */}
                    <div className="text-center">
                      <span className="bg-white/80 backdrop-blur-xs text-[10px] text-slate-500 px-2.5 py-0.5 rounded-full shadow-xs">
                        Today
                      </span>
                    </div>

                    {/* Outbound Message Bubble */}
                    <div className="max-w-[85%] self-end bg-[#DCF8C6] text-slate-800 rounded-2xl rounded-tr-xs p-3 shadow-sm border border-emerald-100 space-y-2">
                      {/* Attached Media in bubble */}
                      {attachment && (
                        <div className="rounded-xl overflow-hidden bg-white/80 border border-slate-200">
                          {attachment.fileType === 'image' && attachmentLocalPreview ? (
                            <div className="relative group">
                              <img
                                src={attachmentLocalPreview}
                                alt="preview"
                                className="w-full max-h-40 object-cover"
                              />
                            </div>
                          ) : attachment.fileType === 'pdf' || attachment.name.endsWith('.pdf') ? (
                            <div className="p-3 flex items-center gap-2.5 bg-rose-50/80">
                              <div className="w-10 h-10 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-semibold text-slate-800 truncate">
                                  {attachment.name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  PDF Document •{' '}
                                  {attachment.size
                                    ? `${(attachment.size / 1024 / 1024).toFixed(1)} MB`
                                    : 'Ready'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 flex items-center gap-2 bg-slate-50">
                              <FileText className="w-6 h-6 text-indigo-600 shrink-0" />
                              <p className="text-xs font-semibold text-slate-800 truncate">
                                {attachment.name}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text */}
                      <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                        {previewPersonalizedText}
                      </p>

                      {/* Metadata / Checkmark */}
                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
                        <span>12:00 PM</span>
                        <span className="text-blue-500 font-bold">✓✓</span>
                      </div>
                    </div>
                  </div>

                  {/* Mock Input Bar */}
                  <div className="p-2 bg-white/90 border-t border-slate-200 flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full px-3 py-1.5 text-[11px] text-slate-400">
                      Reply directly to this chat...
                    </div>
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Send className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Channel Tips Box */}
              <div className="mt-4 p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Broadcasting Pro-Tips
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                  <li>Phone numbers can be with or without country code (e.g. +91 or standard 10-digit).</li>
                  <li>Images are delivered directly into the chat preview.</li>
                  <li>PDF documents show an in-chat brochure preview card with instant download.</li>
                  <li>All replies will sync automatically to your Unified Inbox!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAMPAIGN HISTORY */}
      {activeTab === 'history' && (
        <Card className="border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Broadcast Campaign Blast History
              </h2>
              <p className="text-xs text-slate-500">
                View all previous message broadcasts, delivery statistics, and recipient logs.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchCampaigns}
              className="text-xs gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCampaigns ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <CardContent className="p-0">
            {isLoadingCampaigns ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-sm">Loading campaign history...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Send className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-600">No broadcast campaigns launched yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Upload an Excel spreadsheet with mobile numbers and launch your first WhatsApp or SMS broadcast!
                </p>
                <Button
                  onClick={() => setActiveTab('compose')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                >
                  Create First Broadcast
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Campaign Name</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Attachment</th>
                      <th className="py-3 px-4">Recipients</th>
                      <th className="py-3 px-4">Delivered / Failed</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date Dispatched</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaigns.map((camp) => (
                      <tr key={camp._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {camp.name}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={`capitalize text-xs ${
                              camp.channel === 'whatsapp'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : camp.channel === 'sms'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {camp.channel}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {camp.attachment ? (
                            <a
                              href={camp.attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline font-medium"
                            >
                              <Paperclip className="w-3 h-3" />
                              {camp.attachment.name.slice(0, 15)}...
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {camp.totalRecipients}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-600 font-semibold">
                              ✓ {camp.sentCount}
                            </span>
                            {camp.failedCount > 0 && (
                              <span className="text-rose-500 font-semibold">
                                ✗ {camp.failedCount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${
                              camp.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : camp.status === 'failed'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {camp.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(camp.createdAt).toLocaleDateString()}{' '}
                          {new Date(camp.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleInspectCampaign(camp._id)}
                            className="text-xs h-7 px-2.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DISPATCH PROGRESS / RESULT MODAL */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              {isDispatching ? (
                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center animate-spin">
                  <RefreshCw className="w-7 h-7" />
                </div>
              ) : dispatchError ? (
                <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                  <XCircle className="w-7 h-7" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              )}

              <h3 className="text-lg font-bold text-slate-900">
                {isDispatching
                  ? 'Dispatching Broadcast Blast...'
                  : dispatchError
                  ? 'Broadcast Blast Failed'
                  : 'Broadcast Blast Completed!'}
              </h3>
              <p className="text-xs text-slate-500">
                {isDispatching
                  ? 'Sending personalized messages and media to all verified mobile numbers...'
                  : dispatchError
                  ? dispatchError
                  : `Successfully delivered to ${dispatchSuccess?.sentCount || validContacts.length} recipients.`}
              </p>
            </div>

            {/* Campaign Summary Card */}
            {dispatchSuccess && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Campaign:</span>
                  <span className="font-semibold text-slate-800">{dispatchSuccess.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Channel:</span>
                  <span className="font-semibold capitalize text-indigo-600">
                    {dispatchSuccess.channel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Recipients:</span>
                  <span className="font-semibold text-slate-800">
                    {dispatchSuccess.totalRecipients}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivered Successfully:</span>
                  <span className="font-bold text-emerald-600">
                    ✓ {dispatchSuccess.sentCount}
                  </span>
                </div>
                {dispatchSuccess.failedCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Failed / Invalid:</span>
                    <span className="font-bold text-rose-600">
                      ✗ {dispatchSuccess.failedCount}
                    </span>
                  </div>
                )}
                {dispatchSuccess.attachment && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Media Attached:</span>
                    <span className="font-medium text-indigo-600 flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {dispatchSuccess.attachment.name}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              {!isDispatching && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => {
                      setShowProgressModal(false);
                      setDispatchSuccess(null);
                    }}
                  >
                    Close
                  </Button>
                  <Link href="/client/inbox" className="flex-1">
                    <Button
                      type="button"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                    >
                      View in Inbox
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INSPECT RECIPIENTS MODAL */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedCampaign.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedCampaign.channel.toUpperCase()} Blast · Dispatched on{' '}
                  {new Date(selectedCampaign.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Message Body Snippet */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <span className="font-semibold text-slate-900 block mb-1">Message Content:</span>
              <p className="whitespace-pre-wrap">{selectedCampaign.messageBody}</p>
              {selectedCampaign.attachment && (
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-2 text-indigo-600 font-medium">
                  <Paperclip className="w-3.5 h-3.5" />
                  <a
                    href={selectedCampaign.attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {selectedCampaign.attachment.name}
                  </a>
                </div>
              )}
            </div>

            {/* Recipients Delivery Log Table */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <span className="text-xs font-semibold text-slate-700 mb-2">
                Recipient Delivery Logs ({selectedCampaign.recipients?.length || 0})
              </span>
              <div className="border border-slate-200 rounded-xl overflow-y-auto flex-1 max-h-72">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Recipient</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Delivery Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedCampaign.recipients?.map((rec, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-medium text-slate-800">{rec.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{rec.phone}</td>
                        <td className="py-2 px-3">
                          {rec.status === 'sent' ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              ✓ Sent
                            </span>
                          ) : (
                            <span className="text-rose-500 font-semibold flex items-center gap-1">
                              ✗ Failed
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {rec.error || (rec.sentAt ? `Delivered at ${new Date(rec.sentAt).toLocaleTimeString()}` : 'Delivered')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedCampaign(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
