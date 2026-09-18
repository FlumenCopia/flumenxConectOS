'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Users, UserPlus, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getWorkspaceTeamApi, ClientMemberItem, ClientInvitationItem } from '@/lib/clients';
import { getErrorMessage } from '@/lib/api';

export default function ClientTeamPage() {
  const [members, setMembers] = useState<ClientMemberItem[]>([]);
  const [invitations, setInvitations] = useState<ClientInvitationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getWorkspaceTeamApi();
        setMembers(data.members);
        setInvitations(data.invitations);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        <span className="text-xs">Loading workspace team...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="border-b border-sage-200 pb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-forest-50 text-forest-800 border border-forest-100">
              <Users className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold text-charcoal-900 tracking-tight">
              Workspace Team Members
            </h1>
          </div>
          <p className="text-xs text-sage-500 mt-1">
            Team members with access to this client workspace and associated leads.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <Card className="border-sage-200/90 shadow-soft-xs rounded-2xl overflow-hidden bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-sage-50/70 border-b border-sage-200 text-[11px] font-bold text-sage-600 uppercase tracking-wider">
              <th className="py-3.5 px-5">Member</th>
              <th className="py-3.5 px-4">Role</th>
              <th className="py-3.5 px-4">Membership Status</th>
              <th className="py-3.5 px-4">Joined Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sage-100">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-sage-50/60 transition-colors">
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center font-bold text-xs shadow-2xs">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-charcoal-900">{member.name}</p>
                      <p className="text-[11px] text-sage-400">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <Badge variant={member.roleSlug === 'client_admin' ? 'brand' : 'neutral'} className="rounded-full font-semibold">
                    {member.roleName}
                  </Badge>
                </td>
                <td className="py-3.5 px-4">
                  <Badge variant={member.membershipStatus === 'active' ? 'success' : 'danger'} className="rounded-full font-semibold">
                    {member.membershipStatus.toUpperCase()}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 text-sage-500 font-medium">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
