import React, { useRef } from 'react';
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
      <p className="text-[12px] text-sub mb-6">Select a file to deploy to your project.</p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          onSetDragging(true);
        }}
        onDragLeave={() => onSetDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`
          border border-dashed p-12 text-center cursor-pointer mb-8 transition-all duration-150 rounded
          ${dragging ? 'border-cyan-primary bg-cyan-primary/5' : file ? 'border-cyan-primary/40 bg-surface' : 'border-border-md bg-surface hover:border-sub'}
        `}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(event) => onSelectFile(event.target.files?.[0] || null)}
        />
        {file ? (
          <div>
            <p className="text-[12px] text-cyan-primary mb-1">{file.name}</p>
            <p className="text-[10px] text-sub">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-[12px] mb-1">Drag & drop your file here</p>
            <p className="text-[10px] text-sub">or click to browse</p>
            <p className="text-[9px] text-muted mt-2">ZIP, TAR, JS, PY, GO supported</p>
          </div>
        )}
      </div>
      <div className="mb-8">
        <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={onRegionChange} />
      </div>

      {error && (
        <div className="mb-8 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400 rounded">{error}</div>
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
