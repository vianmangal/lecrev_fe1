import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GhostBtn, CyanBtn, SelectInput, TextInput } from './components/UI';
import { Upload, Code, Terminal, CheckCircle2 } from 'lucide-react';

interface DeployPageProps {
  onBack: () => void;
}

export const DeployPage: React.FC<DeployPageProps> = ({ onBack }) => {
  const [mode, setMode] = useState<"file" | "code" | "function" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [codeVal, setCodeVal] = useState("// Paste or write your code here\n\nexport default function handler(req, res) {\n  res.json({ status: 'ok' });\n}\n");
  const [deployed, setDeployed] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  if (deployed) return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center gap-6"
    >
      <div className="w-14 h-14 rounded-full border border-cyan-primary flex items-center justify-center text-cyan-primary">
        <CheckCircle2 size={32} />
      </div>
      <p className="text-sm uppercase tracking-[0.1em]">Deployment Queued</p>
      <p className="text-[11px] text-sub">lecrev.sh/deploy-{Math.random().toString(36).slice(2, 8)}</p>
      <div className="flex gap-3 mt-2">
        <GhostBtn onClick={() => { setDeployed(false); setMode(null); setFile(null); }}>New Deployment</GhostBtn>
        <CyanBtn onClick={onBack}>View Deployments →</CyanBtn>
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
    <div className="flex-1 overflow-y-auto p-12">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-sub bg-transparent border-none cursor-pointer mb-12 p-0 hover:text-white transition-colors"
      >
        ← Back
      </button>

      <div className="mb-12">
        <h2 className="text-3xl tracking-tighter font-normal mb-3">
          New Deployment
        </h2>
        <p className="text-[12px] text-sub">Choose how you want to deploy your project.</p>
      </div>

      <AnimatePresence mode="wait">
        {!mode ? (
          <motion.div
            key="options"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-3 gap-[2px] mb-12 bg-border"
          >
            {OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className="group bg-black border border-transparent hover:border-border-md p-10 cursor-pointer text-left transition-all duration-150 flex flex-col gap-5"
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
                    border border-dashed p-16 text-center cursor-pointer mb-8 transition-all duration-150
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
                  <SelectInput label="Target Project" options={["Core Platform", "API Gateway", "Design System", "Analytics"]} />
                  <SelectInput label="Environment" options={["Production", "Staging", "Preview"]} />
                </div>
              </>
            )}

            {mode === "code" && (
              <div className="max-w-[800px]">
                <div className="grid grid-cols-2 gap-5 mb-5">
                  <SelectInput label="Language" options={["JavaScript", "TypeScript", "Python", "Go", "Rust"]} />
                  <SelectInput label="Environment" options={["Production", "Staging", "Preview"]} />
                </div>
                <div className="border border-border mb-8">
                  <div className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-sub">index.js</span>
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
                <TextInput label="Function Name" placeholder="my-function" />
                <div className="grid grid-cols-2 gap-5">
                  <SelectInput label="Runtime" options={["Node 20 (LTS)", "Node 22", "Python 3.12", "Go 1.22", "Rust 1.78"]} />
                  <SelectInput label="Trigger Type" options={["HTTP", "Cron Schedule", "Queue Event", "Webhook", "Storage Event"]} />
                </div>
                <SelectInput label="Region" options={["LHR (London)", "IAD (Virginia)", "SIN (Singapore)", "FRA (Frankfurt)", "NRT (Tokyo)"]} />
                <div className="border border-border mt-4">
                  <div className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-sub">handler.js</span>
                    <span className="text-[9px] text-muted uppercase tracking-[0.1em]">Starter Template</span>
                  </div>
                  <textarea
                    defaultValue={"export default async function handler(req, res) {\n  // Your function logic here\n  return res.json({ message: 'Hello from Lecrev!' });\n}\n"}
                    spellCheck={false}
                    className="w-full min-h-[160px] p-5 bg-black text-xs text-neutral-200 leading-relaxed border-none resize-y outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <GhostBtn onClick={() => setMode(null)}>Cancel</GhostBtn>
              <CyanBtn onClick={() => setDeployed(true)}>
                {mode === 'file' && !file ? "Select a File First" : "Deploy →"}
              </CyanBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
