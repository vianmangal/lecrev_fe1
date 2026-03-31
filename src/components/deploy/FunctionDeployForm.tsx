import React from 'react';
import { CyanBtn, GhostBtn, SelectInput } from '../UI';

interface FunctionDeployFormProps {
  code: string;
  error: string | null;
  region: string;
  regionOptions: string[];
  isSubmitting: boolean;
  onCodeChange: (value: string) => void;
  onRegionChange: (region: string) => void;
  onDeploy: () => void;
  onCancel: () => void;
  envVarsSlot?: React.ReactNode;
}

export function FunctionDeployForm({
  code,
  error,
  region,
  regionOptions,
  isSubmitting,
  onCodeChange,
  onRegionChange,
  onDeploy,
  onCancel,
  envVarsSlot,
}: FunctionDeployFormProps) {
  return (
    <div className="max-w-[600px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <SelectInput label="Runtime" options={['node22']} />
        <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={onRegionChange} />
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[10px] uppercase tracking-widest text-sub">Handler Code</label>
          <span className="text-[9px] text-muted uppercase tracking-[0.1em]">Node.js 22 · HTTP trigger</span>
        </div>
        <div className="border border-border bg-surface">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-black/20">
            <div className="w-2 h-2 rounded-full bg-border-md" />
            <span className="text-[9px] text-muted font-mono">handler.mjs</span>
          </div>
          <textarea
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            spellCheck={false}
            placeholder="export async function handler(event, context) {\n  return { ok: true };\n}"
            className="w-full h-[260px] p-4 bg-transparent text-[11px] font-mono text-white focus:outline-none resize-none"
          />
        </div>
      </div>

      {envVarsSlot}

      {error && (
        <div className="mb-6 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400">{error}</div>
      )}

      <div className="flex gap-3">
        <CyanBtn onClick={onDeploy} disabled={!code || isSubmitting}>
          {isSubmitting ? 'Deploying...' : 'Deploy →'}
        </CyanBtn>
        <GhostBtn onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </GhostBtn>
      </div>
    </div>
  );
}
