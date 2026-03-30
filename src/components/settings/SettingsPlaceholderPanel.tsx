import React from 'react';
import { GhostBtn, TextInput } from '../UI';

interface SettingsPlaceholderPanelProps {
  kind: 'team' | 'domains' | 'api_keys';
}

export function SettingsPlaceholderPanel({ kind }: SettingsPlaceholderPanelProps) {
  if (kind === 'team') {
    return (
      <>
        <h3 className="text-sm uppercase tracking-tight font-normal mb-8">Team</h3>
        <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em] border border-border">
          No team members yet
        </div>
        <div className="mt-6"><GhostBtn>+ Invite Member</GhostBtn></div>
      </>
    );
  }

  if (kind === 'domains') {
    return (
      <>
        <h3 className="text-sm uppercase tracking-tight font-normal mb-8">Domains</h3>
        <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em] border border-border mb-6">
          No domains configured
        </div>
        <div className="flex flex-col gap-3">
          <TextInput label="Add Domain" placeholder="yourdomain.com" />
          <GhostBtn>+ Add Domain</GhostBtn>
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
