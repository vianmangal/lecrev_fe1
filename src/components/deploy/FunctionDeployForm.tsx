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
}: FunctionDeployFormProps) {
  return (
    <div className="max-w-[600px]">
      <p className="text-[12px] text-sub mb-8">Configure your serverless function settings and write your handler code.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <SelectInput label="Runtime" options={['node22']} />
        <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={onRegionChange} />
      </div>

      <div className="mb-8">
        <label className="text-[10px] uppercase tracking-widest text-sub block mb-3">Handler Code</label>
        <textarea
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          spellCheck={false}
          placeholder="export async function handler(event, context) {\n  return { ok: true };\n}"
          className="w-full h-[280px] p-4 bg-surface border border-border text-[11px] font-mono text-white focus:outline focus:outline-1 focus:outline-cyan-primary/50 transition-colors resize-none"
        />
        <p className="text-[10px] text-muted mt-2">Node.js 22 runtime with HTTP trigger</p>
      </div>

      {error && (
        <div className="mb-8 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400 rounded">{error}</div>
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
