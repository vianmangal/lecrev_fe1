import React from 'react';
import { motion } from 'motion/react';
import { StatusBadge } from './components/UI';
import { Deployment, Project } from './types';

interface ProjectsScreenProps {
  onViewProject: (p: Project) => void;
  projects?: Project[];
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ onViewProject, projects = [] }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12"
    >
      <div className="flex items-center justify-between border-b border-border pb-3 mb-0">
        <span className="text-[10px] uppercase tracking-[0.15em] text-sub">Projects</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-sub">{projects.length} total</span>
      </div>

      {projects.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-[11px] text-sub uppercase tracking-[0.12em]">
          No projects yet
        </div>
      ) : (
        <div className="bg-border mt-0 space-y-[1px]">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => onViewProject(p)}
              className="group bg-black flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-surface transition-colors duration-150"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] mb-1 group-hover:text-cyan-primary transition-colors duration-150 truncate">{p.name}</p>
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted truncate">{p.url}</p>
              </div>
              <div className="flex items-center gap-6 sm:gap-12 ml-4 shrink-0">
                <div className="text-right">
                  <StatusBadge status={p.status} />
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted mt-1">
                    {p.active ? 'Active · ' : ''}{p.instances}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const DEPLOY_COLS = 'grid-cols-[1.8fr_1.4fr_1.1fr_1fr_1.1fr_1.1fr_0.7fr]';

interface FilterBtnProps {
  val: string;
  cur: string;
  set: (v: string) => void;
}

const FilterBtn: React.FC<FilterBtnProps> = ({ val, cur, set }) => {
  const active = cur === val;
  return (
    <button
      onClick={() => set(active ? 'All' : val)}
      className={`
        border px-4 py-1.5 text-[9px] uppercase tracking-[0.15em] cursor-pointer transition-all duration-150
        ${active ? 'border-border-md text-white bg-surface' : 'border-border text-sub hover:border-border-md hover:text-neutral-300'}
      `}
    >
      {val}
    </button>
  );
};

interface DeploymentsScreenProps {
  deployments?: Deployment[];
}

export const DeploymentsScreen: React.FC<DeploymentsScreenProps> = ({ deployments = [] }) => {
  const [envF, setEnvF] = React.useState('All');
  const [statusF, setStatusF] = React.useState('All');

  const filtered = deployments.filter((d) =>
    (envF === 'All' || d.env === envF) &&
    (statusF === 'All' || d.status === statusF),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h2 className="text-xl uppercase tracking-tight text-sub font-normal">Deployments</h2>
        <span className="text-[10px] uppercase tracking-[0.15em] text-sub">{filtered.length} / {deployments.length} shown</span>
      </div>

      <div className="flex gap-2 mb-8 pb-6 border-b border-border flex-wrap">
        <FilterBtn val="All" cur={envF} set={setEnvF} />
        <FilterBtn val="Production" cur={envF} set={setEnvF} />
        <FilterBtn val="Staging" cur={envF} set={setEnvF} />
        <div className="w-full sm:w-auto sm:ml-auto flex gap-2 flex-wrap">
          {['Active', 'Building', 'Ready', 'Failed'].map((s) => (
            <FilterBtn key={s} val={s} cur={statusF} set={setStatusF} />
          ))}
        </div>
      </div>

      {deployments.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-[11px] text-sub uppercase tracking-[0.12em]">
          No deployments yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className={`grid ${DEPLOY_COLS} gap-3 pb-3 border-b border-border mb-[1px]`}>
              {['Deployment', 'Project', 'Branch', 'Commit', 'Environment', 'Status', 'Age'].map((h) => (
                <span key={h} className="text-[10px] uppercase tracking-[0.15em] text-sub">{h}</span>
              ))}
            </div>
            <div className="bg-border space-y-[1px]">
              {filtered.map((d) => (
                <div
                  key={d.id}
                  className={`grid ${DEPLOY_COLS} gap-3 py-3.5 px-0 bg-black items-center hover:bg-surface transition-colors duration-150 group`}
                >
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
  );
};
