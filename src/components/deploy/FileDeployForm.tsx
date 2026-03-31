import React, { useRef } from 'react';
import { Upload, FileCode, X } from 'lucide-react';
import { CyanBtn, GhostBtn, SelectInput } from '../UI';

interface FileDeployFormProps {
  file: File | null;
  dragging: boolean;
  error: string | null;
  region: string;
  regionOptions: string[];
  isSubmitting: boolean;
  onSelectFile: (file: File | null) => void;
  onSetDragging: (dragging: boolean) => void;
  onRegionChange: (region: string) => void;
  onDeploy: () => void;
  onCancel: () => void;
  envVarsSlot?: React.ReactNode;
}

export function FileDeployForm({
  file,
  dragging,
  error,
  region,
  regionOptions,
  isSubmitting,
  onSelectFile,
  onSetDragging,
  onRegionChange,
  onDeploy,
  onCancel,
  envVarsSlot,
}: FileDeployFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    onSetDragging(false);
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      onSelectFile(droppedFile);
    }
  };

  return (
    <>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          onSetDragging(true);
        }}
        onDragLeave={() => onSetDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && fileRef.current?.click()}
        className={`
          border border-dashed mb-6 transition-all duration-150
          ${dragging
            ? 'border-cyan-primary bg-cyan-primary/5 cursor-copy'
            : file
              ? 'border-cyan-primary/40 bg-surface cursor-default'
              : 'border-border-md bg-surface hover:border-sub cursor-pointer'}
        `}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(event) => onSelectFile(event.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex items-center gap-4 px-5 py-4">
            <FileCode size={20} strokeWidth={1.5} className="text-cyan-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white truncate">{file.name}</p>
              <p className="text-[10px] text-sub mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelectFile(null); fileRef.current && (fileRef.current.value = ''); }}
              className="text-muted hover:text-white transition-colors p-1"
              title="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10">
            <Upload size={24} strokeWidth={1} className={`transition-colors ${dragging ? 'text-cyan-primary' : 'text-sub'}`} />
            <div className="text-center">
              <p className="text-[12px] text-white mb-1">Drag & drop your file here</p>
              <p className="text-[11px] text-sub">or click to browse</p>
            </div>
            <p className="text-[9px] text-muted uppercase tracking-[0.1em]">ZIP · TAR · JS · PY · GO</p>
          </div>
        )}
      </div>

      <div className="mb-6">
        <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={onRegionChange} />
      </div>

      {envVarsSlot}

      {error && (
        <div className="mb-6 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400">{error}</div>
      )}

      <div className="flex gap-3">
        <CyanBtn onClick={onDeploy} disabled={!file || isSubmitting}>
          {isSubmitting ? 'Deploying...' : 'Deploy →'}
        </CyanBtn>
        <GhostBtn onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </GhostBtn>
      </div>
    </>
  );
}
