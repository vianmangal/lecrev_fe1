import React from 'react';

interface EnvVarsEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function EnvVarsEditor({ value, onChange, disabled = false }: EnvVarsEditorProps) {
  return (
    <div className="mb-8">
      <label className="block text-[11px] uppercase tracking-[0.12em] text-sub mb-2">
        Environment Variables
      </label>
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
    </div>
  );
}
