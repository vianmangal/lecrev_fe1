import React from 'react';
import { Globe } from 'lucide-react';

interface FooterProps {
  integrationError: string | null;
  githubConfigured: boolean | null;
  availableRegions: string[];
}

export function Footer({ integrationError, githubConfigured, availableRegions }: FooterProps) {
  return (
    <footer className="h-8 border-t border-border px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${integrationError ? 'bg-amber-500' : 'bg-cyan-primary'}`} />
          LECREV_SYSTEM_CORE
        </div>
        <span>
          {githubConfigured ? 'AUTH: GitHub Ready' : 'AUTH: Optional'}
        </span>
        <span className="flex items-center gap-1"><Globe size={10} /> {availableRegions[0] || 'ap-south-1'}</span>
        <span>{availableRegions.length} regions</span>
      </div>
      <div className="flex gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
        <span>{integrationError ? 'API: Degraded' : 'API: Connected'}</span>
        <span>{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
      </div>
    </footer>
  );
}
