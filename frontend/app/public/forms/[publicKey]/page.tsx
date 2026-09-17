'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { getPublicFormApi, submitPublicFormApi } from '@/lib/forms';

export default function PublicFormPage() {
  const params = useParams();
  const publicKey = params.publicKey as string;

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Submission States
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [honeypotVal, setHoneypotVal] = useState('');
  const [formLoadedAt] = useState<number>(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadForm() {
      if (!publicKey) return;
      try {
        setLoading(true);
        setError(null);
        const res = await getPublicFormApi(publicKey);
        if (res.data) {
          setForm(res.data);
          // Initialize defaults
          const initial: Record<string, any> = {};
          (res.data.fields || []).forEach((f: any) => {
            if (f.defaultValue) initial[f.fieldKey] = f.defaultValue;
          });
          setFormData(initial);
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            'This form is currently unavailable or inactive.'
        );
      } finally {
        setLoading(false);
      }
    }
    loadForm();
  }, [publicKey]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    (form?.fields || []).forEach((field: any) => {
      const val = formData[field.fieldKey];

      if (field.required && (val === undefined || val === null || String(val).trim() === '')) {
        errors[field.fieldKey] = `${field.label} is required`;
      }

      if (val && field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val).trim())) {
          errors[field.fieldKey] = 'Please enter a valid email address';
        }
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setError(null);

      const honeypotKey = form?.honeypotField || '_hp_website';

      const payload = {
        ...formData,
        [honeypotKey]: honeypotVal,
        _form_loaded_at: formLoadedAt,
        sourceUrl: typeof window !== 'undefined' ? window.location.href : '',
      };

      const res = await submitPublicFormApi(publicKey, payload);

      if (res.data?.success) {
        setSubmitSuccess(true);
        setSuccessMessage(res.data.message || form.successMessage || 'Thank you for your submission!');
        const targetRedirect = res.data.redirectUrl;
        if (targetRedirect) {
          setRedirectUrl(targetRedirect);
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.href = targetRedirect;
            }
          }, 2000);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm text-zinc-500">Loading form...</p>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Form Unavailable</h2>
          <p className="text-sm text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Thank You!</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{successMessage}</p>

          {redirectUrl && (
            <p className="text-xs text-zinc-400 animate-pulse">
              Redirecting you automatically to {redirectUrl}...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Form Title Header */}
        <div className="p-6 sm:p-8 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{form.name}</h1>
          {form.description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{form.description}</p>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Invisible Anti-Spam Honeypot Field */}
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
            <label htmlFor="hp_field">Do not fill this field</label>
            <input
              id="hp_field"
              type="text"
              name={form.honeypotField || '_hp_website'}
              value={honeypotVal}
              onChange={(e) => setHoneypotVal(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Dynamic Form Fields */}
          {(form.fields || []).map((field: any) => {
            const hasError = !!fieldErrors[field.fieldKey];

            return (
              <div key={field.fieldKey} className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    rows={4}
                    placeholder={field.placeholder}
                    value={formData[field.fieldKey] || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, [field.fieldKey]: e.target.value });
                      if (fieldErrors[field.fieldKey]) {
                        setFieldErrors({ ...fieldErrors, [field.fieldKey]: '' });
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition focus:outline-none focus:ring-2 ${
                      hasError
                        ? 'border-red-500 focus:ring-red-400'
                        : 'border-zinc-200 dark:border-zinc-700 focus:ring-blue-500'
                    }`}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.fieldKey] || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, [field.fieldKey]: e.target.value });
                      if (fieldErrors[field.fieldKey]) {
                        setFieldErrors({ ...fieldErrors, [field.fieldKey]: '' });
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition focus:outline-none focus:ring-2 ${
                      hasError
                        ? 'border-red-500 focus:ring-red-400'
                        : 'border-zinc-200 dark:border-zinc-700 focus:ring-blue-500'
                    }`}
                  >
                    <option value="">-- Please select --</option>
                    {(field.options || []).map((opt: any) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'radio' ? (
                  <div className="space-y-2 pt-1">
                    {(field.options || []).map((opt: any) => (
                      <label key={opt.value} className="flex items-center gap-2.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={field.fieldKey}
                          value={opt.value}
                          checked={formData[field.fieldKey] === opt.value}
                          onChange={(e) => setFormData({ ...formData, [field.fieldKey]: e.target.value })}
                          className="text-blue-600"
                        />
                        <span className="text-zinc-800 dark:text-zinc-200">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={formData[field.fieldKey] === true}
                      onChange={(e) => setFormData({ ...formData, [field.fieldKey]: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span className="text-zinc-800 dark:text-zinc-200">{field.helpText || field.label}</span>
                  </label>
                ) : (
                  <input
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={formData[field.fieldKey] || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, [field.fieldKey]: e.target.value });
                      if (fieldErrors[field.fieldKey]) {
                        setFieldErrors({ ...fieldErrors, [field.fieldKey]: '' });
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition focus:outline-none focus:ring-2 ${
                      hasError
                        ? 'border-red-500 focus:ring-red-400'
                        : 'border-zinc-200 dark:border-zinc-700 focus:ring-blue-500'
                    }`}
                  />
                )}

                {hasError && <p className="text-xs text-red-500 font-medium">{fieldErrors[field.fieldKey]}</p>}
                {field.helpText && field.type !== 'checkbox' && (
                  <p className="text-xs text-zinc-400">{field.helpText}</p>
                )}
              </div>
            );
          })}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {form.submitButtonLabel || 'Submit Form'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
