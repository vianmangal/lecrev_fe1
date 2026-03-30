import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GhostBtn, CyanBtn, SelectInput, TextInput } from './components/UI';
import { Upload, Code, Terminal, CheckCircle2 } from 'lucide-react';
import { DeployRequestInput } from './api';

interface DeployPageProps {
  onBack: () => void;
  onDeploy: (request: DeployRequestInput) => Promise<{ versionId: string; buildJobId?: string }>;
  defaultProjectId: string;
  regionOptions: string[];
}

const DEFAULT_HANDLER = "export async function handler(event, context) {\n  return { ok: true, echo: event, region: context.region, hostId: context.hostId };\n}\n";

export const DeployPage: React.FC<DeployPageProps> = ({ onBack, onDeploy, defaultProjectId, regionOptions }) => {
  const [mode, setMode] = useState<"file" | "code" | "function" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [codeVal, setCodeVal] = useState(DEFAULT_HANDLER);
  const [functionVal, setFunctionVal] = useState(DEFAULT_HANDLER);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [environment, setEnvironment] = useState<'Production' | 'Staging' | 'Preview'>('Production');
  const [region, setRegion] = useState(regionOptions[0] || 'ap-south-1');
  const [functionName, setFunctionName] = useState('ui-function');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployInfo, setDeployInfo] = useState<{ versionId: string; buildJobId?: string } | null>(null);
  const [deployed, setDeployed] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProjectId(defaultProjectId);
  }, [defaultProjectId]);

  useEffect(() => {
    if (regionOptions.length === 0) {
      setRegion('ap-south-1');
      return;
    }
    setRegion((current) => (regionOptions.includes(current) ? current : regionOptions[0]));
  }, [regionOptions]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const sanitizeName = (value: string): string => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || 'ui-function';
  };

  const buildRequest = async (): Promise<DeployRequestInput> => {
    if (!mode) {
      throw new Error('Select a deployment mode first.');
    }
    const selectedRegion = region.trim() || regionOptions[0] || 'ap-south-1';
    const cleanedProject = projectId.trim() || defaultProjectId.trim();
    const cleanedName = sanitizeName(functionName);

    if (mode === 'file') {
      if (!file) {
        throw new Error('Select a file before deploying.');
      }
      const content = await file.text();
      const entrypoint = file.name || 'index.mjs';
      return {
        projectId: cleanedProject,
        name: cleanedName,
        environment,
        region: selectedRegion,
        entrypoint,
        inlineFiles: {
          [entrypoint]: content,
        },
      };
    }

    if (mode === 'code') {
      return {
        projectId: cleanedProject,
        name: cleanedName,
        environment,
        region: selectedRegion,
        entrypoint: 'index.mjs',
        inlineFiles: {
          'index.mjs': codeVal,
        },
      };
    }

    return {
      projectId: cleanedProject,
      name: cleanedName,
      environment,
      region: selectedRegion,
      entrypoint: 'handler.mjs',
      inlineFiles: {
        'handler.mjs': functionVal,
      },
    };
  };

  const handleDeploy = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const request = await buildRequest();
      const info = await onDeploy(request);
      setDeployInfo(info);
      setDeployed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = mode !== null && !(mode === 'file' && !file) && !isSubmitting;

  if (deployed) return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 px-4"
    >
      <div className="w-14 h-14 rounded-full border border-cyan-primary flex items-center justify-center text-cyan-primary">
        <CheckCircle2 size={32} />
      </div>
      <p className="text-sm uppercase tracking-[0.1em]">Deployment Queued</p>
      <p className="text-[11px] text-sub">{deployInfo?.buildJobId || deployInfo?.versionId || 'deployment'}</p>
      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
        <GhostBtn className="w-full sm:w-auto" onClick={() => { setDeployed(false); setMode(null); setFile(null); setDeployInfo(null); setError(null); }}>New Deployment</GhostBtn>
        <CyanBtn className="w-full sm:w-auto" onClick={onBack}>View Deployments →</CyanBtn>
      </div>
    </motion.div>
  );

  const OPTIONS = [
    {
      id: "file" as const,
      label: "Upload File",
      icon: <Upload size={32} strokeWidth={1} />,
      desc: "Upload a ZIP, tarball, or single file to deploy directly to your project."
    },
    {
      id: "code" as const,
      label: "Code Editor",
      icon: <Code size={32} strokeWidth={1} />,
      desc: "Write or paste code directly into the editor and deploy in one click."
    },
    {
      id: "function" as const,
      label: "Function",
      icon: <Terminal size={32} strokeWidth={1} />,
      desc: "Deploy a serverless function with an HTTP trigger, cron schedule, or event source."
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-sub bg-transparent border-none cursor-pointer mb-12 p-0 hover:text-white transition-colors"
      >
        ← Back
      </button>

      <div className="mb-12">
        <h2 className="text-2xl sm:text-3xl tracking-tighter font-normal mb-3">
          New Deployment
        </h2>
        <p className="text-[12px] text-sub">Choose how you want to deploy your project.</p>
        <p className="text-[10px] text-muted mt-2 uppercase tracking-[0.12em]">V1 runtime is node22 with APAC regions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10 max-w-[780px]">
        <TextInput label="Project ID" value={projectId} onChange={setProjectId} placeholder="demo" />
        <TextInput label="Function Name" value={functionName} onChange={setFunctionName} placeholder="ui-function" />
        <SelectInput label="Environment" options={["Production", "Staging", "Preview"]} value={environment} onChange={(value) => setEnvironment(value as 'Production' | 'Staging' | 'Preview')} />
      </div>

      <AnimatePresence mode="wait">
        {!mode ? (
          <motion.div
            key="options"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-[2px] mb-12 bg-border"
          >
            {OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className="group bg-black border border-transparent hover:border-border-md p-6 sm:p-10 cursor-pointer text-left transition-all duration-150 flex flex-col gap-5"
              >
                <div className="text-sub group-hover:text-cyan-primary transition-colors duration-150">{opt.icon}</div>
                <div>
                  <p className="text-[13px] mb-2 text-white">{opt.label}</p>
                  <p className="text-[11px] text-sub leading-relaxed">{opt.desc}</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted group-hover:text-cyan-primary mt-auto transition-colors">
                  Select →
                </span>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-[640px]"
          >
            <div className="flex items-center gap-3 mb-8">
              <button onClick={() => setMode(null)} className="text-[9px] uppercase tracking-[0.15em] text-sub bg-transparent border-none cursor-pointer hover:text-white">← Change Mode</button>
              <span className="text-[9px] text-muted">/ {mode === 'file' ? 'Upload File' : mode === 'code' ? 'Code Editor' : 'Serverless Function'}</span>
            </div>

            {mode === "file" && (
              <>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`
                    border border-dashed p-10 sm:p-16 text-center cursor-pointer mb-8 transition-all duration-150
                    ${dragging ? "border-cyan-primary bg-cyan-primary/5" : file ? "border-cyan-primary/40 bg-surface" : "border-border-md bg-surface hover:border-sub"}
                  `}
                >
                  <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  {file ? (
                    <div>
                      <p className="text-[13px] text-cyan-primary mb-2">{file.name}</p>
                      <p className="text-[10px] text-sub">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl text-muted mb-4">↑</div>
                      <p className="text-[12px] mb-2">Drag & drop your file here</p>
                      <p className="text-[10px] text-sub">or click to browse · ZIP, TAR, JS, PY, GO supported</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-5 mb-8">
                  <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={setRegion} />
                </div>
              </>
            )}

            {mode === "code" && (
              <div className="max-w-[800px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                  <SelectInput label="Runtime" options={["node22"]} />
                  <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={setRegion} />
                </div>
                <div className="border border-border mb-8">
                  <div className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-sub">index.mjs</span>
                    <div className="flex gap-1.5">
                      {["#ff5f56", "#ffbd2e", "#27c93f"].map(c => (
                        <div key={c} className="w-2.5 h-2.5 rounded-full opacity-70" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={codeVal}
                    onChange={e => setCodeVal(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[280px] p-5 bg-black text-xs text-neutral-200 leading-relaxed border-none resize-y outline-none"
                  />
                </div>
              </div>
            )}

            {mode === "function" && (
              <div className="flex flex-col gap-5 mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SelectInput label="Runtime" options={["node22"]} />
                  <SelectInput label="Trigger Type" options={["HTTP"]} />
                </div>
                <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={setRegion} />
                <div className="border border-border mt-4">
                  <div className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-sub">handler.mjs</span>
                    <span className="text-[9px] text-muted uppercase tracking-[0.1em]">Starter Template</span>
                  </div>
                  <textarea
                    value={functionVal}
                    onChange={(e) => setFunctionVal(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[160px] p-5 bg-black text-xs text-neutral-200 leading-relaxed border-none resize-y outline-none"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mb-5 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <GhostBtn className="w-full sm:w-auto" onClick={() => { setMode(null); setError(null); }} disabled={isSubmitting}>Cancel</GhostBtn>
              <CyanBtn className="w-full sm:w-auto" onClick={handleDeploy} disabled={!canSubmit}>
                {isSubmitting ? 'Submitting...' : mode === 'file' && !file ? 'Select a File First' : 'Deploy ->'}
              </CyanBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
