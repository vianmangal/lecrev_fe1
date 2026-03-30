import React from 'react';
import { Code, Terminal, Upload } from 'lucide-react';
import { motion } from 'motion/react';

export type DeployMode = 'file' | 'code' | 'function';

const OPTIONS: Array<{
  id: DeployMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'file',
    label: 'Upload File',
    description: 'Upload a ZIP, tarball, or single file to deploy directly to your project.',
    icon: <Upload size={32} strokeWidth={1} />,
  },
  {
    id: 'code',
    label: 'GitHub Import',
    description: 'Import a repository through the GitHub App and deploy a runnable entry file.',
    icon: <Code size={32} strokeWidth={1} />,
  },
  {
    id: 'function',
    label: 'Function',
    description: 'Deploy a serverless function directly from the in-browser editor.',
    icon: <Terminal size={32} strokeWidth={1} />,
  },
];

export function DeployModePicker({ onSelect }: { onSelect: (mode: DeployMode) => void }) {
  return (
    <motion.div
      key="options"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 sm:grid-cols-3 gap-[2px] mb-12 bg-border"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option.id)}
          className="group bg-black border border-transparent hover:border-border-md p-8 cursor-pointer text-left transition-all duration-150 flex flex-col gap-4"
        >
          <div className="text-sub group-hover:text-cyan-primary transition-colors duration-150">{option.icon}</div>
          <div>
            <p className="text-[12px] mb-2 text-white font-medium">{option.label}</p>
            <p className="text-[11px] text-sub leading-relaxed">{option.description}</p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted group-hover:text-cyan-primary mt-auto transition-colors">
            Select →
          </span>
        </button>
      ))}
    </motion.div>
  );
}
