import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LOGS, DEPLOYS } from './constants';
import { StatusBadge, CyanBtn, TextInput, SelectInput } from './components/UI';
import { Deployment, LogEntry, Project } from './types';

interface DetailScreenProps {
  project: Project | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
  deployments?: Deployment[];
  logs?: LogEntry[];
}

export const DetailScreen: React.FC<DetailScreenProps> = ({ project, activeTab, setActiveTab, deployments, logs }) => {
  const p = project || { id: 'core-platform', name: 'Core Platform', url: 'core-platform.lecrev.app', status: 'Production' as const, instances: '24' };
  const TABS = ['deployments', 'logs', 'settings'];
  const deploymentRows = deployments && deployments.length > 0 ? deployments : DEPLOYS;
  const logRows = logs && logs.length > 0 ? logs : LOGS;
  const latestDeploy = deploymentRows[0];

  const infoRows: Array<[string, string]> = [
    ['Branch', latestDeploy?.branch || 'main'],
    ['Commit', latestDeploy?.commit || '7a0f3d2'],
    ['Region', latestDeploy?.region || 'ap-south-1'],
    ['Instances', latestDeploy?.status === 'Active' ? '1' : '0'],
    ['Age', latestDeploy?.age || 'now'],
    ['Version', latestDeploy ? latestDeploy.id.slice(0, 12) : 'v-local'],
  ];

  const pts = [20, 45, 30, 70, 55, 80, 60, 90, 75, 95, 85, 100];
  const W = 400;
  const H = 80;
  const pathD = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * W} ${H - (v / 100) * H}`).join(' ');
  const areaD = pathD + ` L${W} ${H} L0 ${H} Z`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex-1 overflow-y-auto p-12"
    >
      <div className="flex items-start justify-between mb-12">
        <div>
          <h2 className="text-4xl tracking-tighter font-normal mb-3">
            {p.url}
          </h2>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-cyan-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary animate-pulse-cyan" />
            System Online
          </div>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <div className="grid grid-cols-2 gap-16 mb-12">
        <div className="grid grid-cols-2 gap-6">
          {infoRows.map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1.5">{k}</p>
              <p className="text-[13px]">{v}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-4">Request Rate (req/s)</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
            <defs>
              <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#ag)" />
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              d={pathD}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1.5"
            />
          </svg>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-sub">0</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-sub">peak: 847 req/s</span>
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
            <div className="grid grid-cols-[1.8fr_1.4fr_1.1fr_1fr_1.1fr_1.1fr_0.7fr] gap-3 pb-3 border-b border-border mb-[1px]">
              {['Deployment', 'Project', 'Branch', 'Commit', 'Environment', 'Status', 'Age'].map((h) => (
                <span key={h} className="text-[10px] uppercase tracking-[0.15em] text-sub">{h}</span>
              ))}
            </div>
            <div className="bg-border space-y-[1px]">
              {deploymentRows.slice(0, 4).map((d) => (
                <div key={d.id} className="grid grid-cols-[1.8fr_1.4fr_1.1fr_1fr_1.1fr_1.1fr_0.7fr] gap-3 py-3.5 px-0 bg-black items-center hover:bg-surface transition-colors duration-150 group">
                  <span className="text-[10px] text-muted">{d.id}</span>
                  <span className="text-[12px] text-white group-hover:text-cyan-primary transition-colors duration-150">{d.project}</span>
                  <span className="text-[11px] text-neutral-400">{d.branch}</span>
                  <span className="text-[11px] text-neutral-400">{d.commit}</span>
                  <StatusBadge status={d.env} />
                  <StatusBadge status={d.status} />
                  <span className="text-[11px] text-sub">{d.age}</span>
                </div>
              ))}
            </div>
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
            {logRows.map((l, i) => (
              <div key={i} className={`flex gap-6 p-2.5 items-baseline ${i % 2 === 0 ? 'bg-surface' : 'bg-black'}`}>
                <span className="text-[11px] text-neutral-600 shrink-0 w-[110px]">{l.t}</span>
                <span className={`text-[10px] uppercase tracking-[0.12em] shrink-0 w-11 ${l.level === 'ERROR' ? 'text-red-500' : l.level === 'WARN' ? 'text-amber-500' : 'text-cyan-primary'}`}>
                  {l.level}
                </span>
                <span className="text-[12px] text-neutral-200">{l.msg}</span>
              </div>
            ))}
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
            <TextInput label="Project Name" defaultValue={p.name} />
            <TextInput label="Domain" defaultValue={p.url} />
            <SelectInput label="Region" options={['ap-south-1', 'ap-south-2', 'ap-southeast-1']} />
            <div className="flex justify-end pt-2">
              <CyanBtn>Save Changes</CyanBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
