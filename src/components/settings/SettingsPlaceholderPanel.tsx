import React, { useEffect, useMemo, useState } from 'react';
import { GhostBtn, SelectInput, TextInput } from '../UI';

interface SettingsPlaceholderPanelProps {
  kind: 'team' | 'domains' | 'api_keys';
  scopeKey?: string;
}

interface TeamMember {
  id: string;
  email: string;
  role: 'Admin' | 'Developer' | 'Viewer';
  invitedAt: string;
}

interface DomainItem {
  id: string;
  host: string;
  addedAt: string;
}

function safeStorageRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const strippedProtocol = trimmed.replace(/^https?:\/\//, '');
  return strippedProtocol.replace(/\/.*$/, '');
}

function isValidDomain(host: string): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function SettingsPlaceholderPanel({ kind, scopeKey = 'default' }: SettingsPlaceholderPanelProps) {
  const teamStorageKey = useMemo(() => `lecrev:settings:team:${scopeKey}`, [scopeKey]);
  const domainStorageKey = useMemo(() => `lecrev:settings:domains:${scopeKey}`, [scopeKey]);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Developer' | 'Viewer'>('Developer');
  const [teamError, setTeamError] = useState<string | null>(null);

  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);

  useEffect(() => {
    const storedMembers = safeStorageRead<TeamMember[]>(teamStorageKey, []);
    const storedDomains = safeStorageRead<DomainItem[]>(domainStorageKey, []);
    setMembers(storedMembers);
    setDomains(storedDomains);
  }, [teamStorageKey, domainStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(teamStorageKey, JSON.stringify(members));
  }, [members, teamStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(domainStorageKey, JSON.stringify(domains));
  }, [domains, domainStorageKey]);

  const handleInviteMember = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setTeamError('Enter a valid email address.');
      return;
    }
    if (members.some((member) => member.email === email)) {
      setTeamError('This member is already invited.');
      return;
    }
    setMembers((prev) => [
      {
        id: `member-${Date.now()}`,
        email,
        role: inviteRole,
        invitedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setInviteEmail('');
    setTeamError(null);
  };

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const handleAddDomain = () => {
    const host = normalizeDomain(domainInput);
    if (!isValidDomain(host)) {
      setDomainError('Enter a valid domain, e.g. app.example.com');
      return;
    }
    if (domains.some((domain) => domain.host === host)) {
      setDomainError('This domain is already added.');
      return;
    }
    setDomains((prev) => [
      {
        id: `domain-${Date.now()}`,
        host,
        addedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setDomainInput('');
    setDomainError(null);
  };

  const handleRemoveDomain = (id: string) => {
    setDomains((prev) => prev.filter((domain) => domain.id !== id));
  };

  if (kind === 'team') {
    return (
      <>
        <h3 className="text-sm uppercase tracking-tight font-normal mb-8">Team</h3>
        <div className="border border-border">
          {members.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em]">
              No team members yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[12px] text-white truncate">{member.email}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-sub mt-1">{member.role} · Invited</p>
                  </div>
                  <GhostBtn small onClick={() => handleRemoveMember(member.id)}>
                    Remove
                  </GhostBtn>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <TextInput
            label="Invite by Email"
            placeholder="teammate@company.com"
            value={inviteEmail}
            onChange={setInviteEmail}
          />
          <SelectInput
            label="Role"
            options={['Admin', 'Developer', 'Viewer']}
            value={inviteRole}
            onChange={(value) => setInviteRole(value as 'Admin' | 'Developer' | 'Viewer')}
          />
          {teamError && <p className="text-[10px] text-red-400">{teamError}</p>}
          <GhostBtn onClick={handleInviteMember}>+ Invite Member</GhostBtn>
        </div>
      </>
    );
  }

  if (kind === 'domains') {
    return (
      <>
        <h3 className="text-sm uppercase tracking-tight font-normal mb-8">Domains</h3>
        <div className="border border-border mb-6">
          {domains.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em]">
              No domains configured
            </div>
          ) : (
            <div className="divide-y divide-border">
              {domains.map((domain) => (
                <div key={domain.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[12px] text-white truncate">{domain.host}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-sub mt-1">Connected</p>
                  </div>
                  <GhostBtn small onClick={() => handleRemoveDomain(domain.id)}>
                    Remove
                  </GhostBtn>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <TextInput
            label="Add Domain"
            placeholder="yourdomain.com"
            value={domainInput}
            onChange={setDomainInput}
          />
          {domainError && <p className="text-[10px] text-red-400">{domainError}</p>}
          <GhostBtn onClick={handleAddDomain}>+ Add Domain</GhostBtn>
        </div>
      </>
    );
  }

  return (
    <>
      <h3 className="text-sm uppercase tracking-tight font-normal mb-8">API Keys</h3>
      <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em] border border-border mb-4">
        No API keys generated
      </div>
      <GhostBtn>+ Generate New Key</GhostBtn>
    </>
  );
}
