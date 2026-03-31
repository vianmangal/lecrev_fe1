import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StatusBadge } from './components/UI';
import { Deployment, LogEntry, Project } from './types';
import { HTTPTrigger } from './api';
import { DetailInfoGrid } from './components/detail/DetailInfoGrid';
import { FunctionURLPanel } from './components/detail/FunctionURLPanel';
import { LogsPanel } from './components/detail/LogsPanel';
import { ProjectSettingsPanel } from './components/detail/ProjectSettingsPanel';
import { DeploymentTable } from './components/deployments/DeploymentTable';

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8 md:mb-12">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tighter font-normal mb-3 break-all">
            {project.url}
          </h2>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-cyan-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary" />
            System Online
          </div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <DetailInfoGrid rows={infoRows} />

      <FunctionURLPanel
        latestFunctionURL={latestFunctionURL}
        busy={functionURLBusy}
        error={functionURLError}
        onCreate={onCreateFunctionURL}
      />

      <div className="border-b border-border flex gap-5 sm:gap-8 mb-8 relative overflow-x-auto whitespace-nowrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`
              shrink-0 text-[10px] uppercase tracking-[0.12em] bg-transparent border-none pb-2.5 cursor-pointer transition-colors duration-150 mb-[-1px] relative
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
            <DeploymentTable deployments={deployments} emptyLabel="No deployments yet" limit={4} />
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
            <LogsPanel logs={logs} />
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
            <ProjectSettingsPanel name={project.name} url={project.url} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
