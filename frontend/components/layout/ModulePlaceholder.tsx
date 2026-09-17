import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Clock, Sparkles, CheckCircle2 } from 'lucide-react';

interface ModulePlaceholderProps {
  title: string;
  description: string;
  releaseNumber: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  backLink: string;
  backText: string;
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  title,
  description,
  releaseNumber,
  icon: Icon,
  features,
  backLink,
  backText,
}) => {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link href={backLink}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{backText}</span>
            </Button>
          </Link>
        }
      />

      <Card className="border-dashed border-slate-300 bg-white">
        <CardContent className="p-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-brand-50 border border-brand-200 text-brand-800 flex items-center justify-center mx-auto shadow-sm">
              <Icon className="h-7 w-7" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
              <Clock className="h-3.5 w-3.5 text-brand-700" />
              <span>Target Implementation: <strong className="text-slate-900 font-semibold">{releaseNumber}</strong></span>
            </div>

            <h2 className="text-xl font-bold text-slate-900">{title} Module In Active Roadmap</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              This module is scheduled for development in {releaseNumber} of the flumenxConectOS roadmap. 
              The architectural foundations, client tenant boundaries, and database models are established.
            </p>

            <div className="pt-4 pb-2">
              <div className="text-left bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-brand-700" />
                  Planned Core Capabilities:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <Link href={backLink}>
                <Button size="sm">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{backText}</span>
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
