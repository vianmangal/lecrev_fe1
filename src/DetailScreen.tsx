import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StatusBadge, CyanBtn, GhostBtn, TextInput } from './components/UI';
import { Deployment, LogEntry, Project } from './types';
import { HTTPTrigger } from './api';

interface DetailScreenProps {
  project: Project | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
  deployments?: Deployment[];
  logs?: LogEntry[];
  functionURLs?: HTTPTrigger[];
  functionURLBusy?: boolean;
  functionURLError?: string | null;
  onCreateFunctionURL?: () => void;
}

export const DetailScreen: React.FC<DetailScreenProps> = ({
  project,
  activeTab,
  setActiveTab,
  deployments = [],
  logs = [],
  functionURLs = [],
  functionURLBusy = false,
  functionURLError = null,
  onCreateFunctionURL,
}) => {
  if (!project) return null;

  const TABS = ['deployments', 'logs', 'settings'];
  const latestDeploy = deployments[0];
  const latestFunctionURL = functionURLs[0];

  const infoRows: Array<[string, string]> = [
    ['Branch', latestDeploy?.branch ?? '-'],
    ['Commit', latestDeploy?.commit ?? '-'],
    ['Region', latestDeploy?.region ?? '-'],
    ['Instances', latestDeploy?.status === 'Active' ? '1' : '0'],
    ['Age', latestDeploy?.age ?? '-'],
    ['Version', latestDeploy ? latestDeploy.id.slice(0, 12) : '-'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12"
    >
      <div className="flex items-start justify-between mb-8 md:mb-12">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tighter font-normal mb-3">
            {project.url}
          </h2>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-cyan-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary animate-pulse-cyan" />
            System Online
          </div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 md:mb-12">
        {infoRows.map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1.5">{k}</p>
            <p className="text-[13px]">{v}</p>
          </div>
        ))}
      </div>

      <div className="border border-border bg-surface/40 p-4 sm:p-5 mb-8 md:mb-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-primary mb-2">Function URL</p>
            {latestFunctionURL ? (
              <>
                <p className="text-sm text-white break-all">{latestFunctionURL.url}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-sub mt-2">
                  Public HTTP entrypoint for the latest deployment
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-white">No public URL generated yet.</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-sub mt-2">
                  Create one to invoke this function over HTTP like a Lambda Function URL
                </p>
              </>
            )}
            {functionURLError && (
              <p className="text-[10px] uppercase tracking-[0.12em] text-red-500 mt-3">{functionURLError}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {latestFunctionURL && (
              <>
                <GhostBtn
                  small
                  onClick={() => {
                    window.navigator.clipboard.writeText(latestFunctionURL.url).catch(() => undefined);
                  }}
                >
                  Copy URL
                </GhostBtn>
                <GhostBtn
                  small
                  onClick={() => {
                    window.open(latestFunctionURL.url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Open URL
                </GhostBtn>
              </>
            )}
            {onCreateFunctionURL && (
              <CyanBtn onClick={onCreateFunctionURL} className="px-4 py-1.5" disabled={functionURLBusy}>
                {latestFunctionURL ? 'Refresh URL' : functionURLBusy ? 'Creating...' : 'Generate URL'}
              </CyanBtn>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-border flex gap-8 mb-8 relative">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`
              text-[10px] uppercase tracking-[0.12em] bg-transparent border-none pb-2.5 cursor-pointer transition-colors duration-150 mb-[-1px] relative
              ${activeTab === t ? 'text-white' : 'text-sub hover:text-neutral-300'}
            `}
          >
            {t}
            {activeTab === t && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-[1px] bg-white"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'deployments' && (
          <motion.div
            key="deployments"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {deployments.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em]">
                No deployments yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-[1.8fr_1.4fr_1.1fr_1fr_1.1fr_1.1fr_0.7fr] gap-3 pb-3 border-b border-border mb-[1px]">
                    {['Deployment', 'Project', 'Branch', 'Commit', 'Environment', 'Status', 'Age'].map((h) => (
                      <span key={h} className="text-[10px] uppercase tracking-[0.15em] text-sub">{h}</span>
                    ))}
                  </div>
                  <div className="bg-border space-y-[1px]">
                    {deployments.slice(0, 4).map((d) => (
                      <div key={d.id} className="grid grid-cols-[1.8fr_1.4fr_1.1fr_1fr_1.1fr_1.1fr_0.7fr] gap-3 py-3.5 px-0 bg-black items-center hover:bg-surface transition-colors duration-150 group">
                        <span className="text-[10px] text-muted truncate">{d.id}</span>
                        <span className="text-[12px] text-white group-hover:text-cyan-primary transition-colors duration-150">{d.project}</span>
                        <span className="text-[11px] text-neutral-400">{d.branch}</span>
                        <span className="text-[11px] text-neutral-400">{d.commit}</span>
                        <StatusBadge status={d.env} />
                        <StatusBadge status={d.status} />
                        <span className="text-[11px] text-sub">{d.age}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="border border-border"
          >
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em]">
                No logs available
              </div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className={`flex gap-4 sm:gap-6 p-2.5 items-baseline ${i % 2 === 0 ? 'bg-surface' : 'bg-black'}`}>
                  <span className="text-[11px] text-neutral-600 shrink-0 w-[80px] sm:w-[110px]">{l.t}</span>
                  <span className={`text-[10px] uppercase tracking-[0.12em] shrink-0 w-11 ${l.level === 'ERROR' ? 'text-red-500' : l.level === 'WARN' ? 'text-amber-500' : 'text-cyan-primary'}`}>
                    {l.level}
                  </span>
                  <span className="text-[12px] text-neutral-200 min-w-0 break-all">{l.msg}</span>
                </div>
              ))
            )}
          </motion.div>
        )}
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-[460px] flex flex-col gap-6"
          >
            <TextInput label="Project Name" defaultValue={project.name} />
            <TextInput label="Domain" defaultValue={project.url} />
            <div className="flex justify-end pt-2">
              <CyanBtn>Save Changes</CyanBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
