import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface EnvVarsEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  collapsible?: boolean;
}

export function EnvVarsEditor({ value, onChange, disabled = false, collapsible = false }: EnvVarsEditorProps) {
  const [open, setOpen] = useState(!collapsible);

  return (
    <div className="mb-8">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between text-[10px] uppercase tracking-[0.12em] text-sub hover:text-white transition-colors mb-2"
        >
          <span className="flex items-center gap-2">
            Environment Variables
            <span className="normal-case tracking-normal text-muted text-[9px]">(optional)</span>
          </span>
          <ChevronDown size={12} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <label className="block text-[11px] uppercase tracking-[0.12em] text-sub mb-2">
          Environment Variables
        </label>
      )}
      {open && (
        <>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            placeholder={'NEXT_PUBLIC_SITE_URL=https://example.com\nMEDIUM_FEED_URL=https://medium.com/gdg-vit?format=json'}
            className="min-h-[140px] w-full rounded border border-border bg-surface px-4 py-3 text-[12px] text-white outline-none transition-colors duration-150 placeholder:text-muted focus:border-cyan-primary disabled:cursor-not-allowed disabled:opacity-60"
            spellCheck={false}
          />
          <p className="mt-2 text-[10px] text-muted">
            One per line in <code>KEY=VALUE</code> format. Use this for plain deploy config. Keep secrets in managed secret refs.
          </p>
        </>
      )}
    </div>
  );
}
