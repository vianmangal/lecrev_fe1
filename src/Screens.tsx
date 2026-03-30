import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DEPLOYS, PROJECTS } from './constants';
import { StatusBadge, GhostBtn } from './components/UI';
import { Project } from './types';

interface ProjectsScreenProps {
  onViewProject: (p: Project) => void;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ onViewProject }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex-1 overflow-y-auto p-12"
    >
      <div className="mb-12">
        <h2 className="text-xl uppercase tracking-tight text-sub font-normal">Production</h2>
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted">Stable_Release</span>
      </div>

      <div className="mb-12">
        <h3 className="text-5xl tracking-tighter mb-5 font-normal">
          lecrev.sh/main-abc
        </h3>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-cyan-primary">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary animate-pulse-cyan" />
          System Online
        </div>
      </div>

      <div className="grid grid-cols-4 gap-10 mb-12">
        {[["Branch", "main"], ["Commit", "7a0f3d2"], ["Age", "2m"], ["Region", "LHR"]].map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-2">{k}</p>
            <p className="text-sm">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-20">
        <GhostBtn>Open Instance ↗</GhostBtn>
        <button className="text-[10px] uppercase tracking-[0.15em] text-sub bg-transparent border-none cursor-pointer px-4 py-1.5 hover:text-white transition-colors">
          View Logs
        </button>
      </div>

      <section>
        <div className="flex items-center justify-between border-bottom border-border pb-3 mb-0">
          <span className="text-[10px] uppercase tracking-[0.15em] text-sub">Recent Projects</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-sub cursor-pointer hover:text-white">View All</span>
        </div>
        <div className="bg-border mt-0 space-y-[1px]">
          {PROJECTS.map(p => (
            <div
              key={p.name}
              onClick={() => onViewProject(p)}
              className="group bg-black flex items-center justify-between p-6 cursor-pointer hover:bg-surface transition-colors duration-150"
            >
              <div>
                <p className="text-[13px] mb-1 group-hover:text-cyan-primary transition-colors duration-150">{p.name}</p>
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted">{p.url}</p>
              </div>
              <div className="flex items-center gap-12">
                <div className="text-right">
                  <StatusBadge status={p.status} />
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted mt-1">
                    {p.active ? "Active · " : ""}{p.instances}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};

const DEPLOY_COLS = "grid-cols-[1.8fr_1.4fr_1.1fr_1fr_1.1fr_1.1fr_0.7fr]";

interface FilterBtnProps {
  val: string;
  cur: string;
  set: (v: string) => void;
}

const FilterBtn: React.FC<FilterBtnProps> = ({ val, cur, set }) => {
  const active = cur === val;
  return (
    <button
      onClick={() => set(active ? "All" : val)}
      className={`
        border px-4 py-1.5 text-[9px] uppercase tracking-[0.15em] cursor-pointer transition-all duration-150
        ${active ? "border-border-md text-white bg-surface" : "border-border text-sub hover:border-border-md hover:text-neutral-300"}
      `}
    >
      {val}
    </button>
  );
};

export const DeploymentsScreen: React.FC = () => {
  const [envF, setEnvF] = React.useState("All");
  const [statusF, setStatusF] = React.useState("All");

  const filtered = DEPLOYS.filter(d =>
    (envF === "All" || d.env === envF) &&
    (statusF === "All" || d.status === statusF)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex-1 overflow-y-auto p-12"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl uppercase tracking-tight text-sub font-normal">Deployments</h2>
        <span className="text-[10px] uppercase tracking-[0.15em] text-sub">{filtered.length} / {DEPLOYS.length} shown</span>
      </div>

      <div className="flex gap-2 mb-8 pb-6 border-b border-border flex-wrap">
        <FilterBtn val="All" cur={envF} set={setEnvF} />
        <FilterBtn val="Production" cur={envF} set={setEnvF} />
        <FilterBtn val="Staging" cur={envF} set={setEnvF} />
        <div className="ml-auto flex gap-2">
          {["Active", "Building", "Failed"].map(s =>
            <FilterBtn key={s} val={s} cur={statusF} set={setStatusF} />
          )}
        </div>
      </div>

      <div className={`grid ${DEPLOY_COLS} gap-3 pb-3 border-b border-border mb-[1px]`}>
        {["Deployment", "Project", "Branch", "Commit", "Environment", "Status", "Age"].map(h =>
          <span key={h} className="text-[10px] uppercase tracking-[0.15em] text-sub">{h}</span>
        )}
      </div>

      <div className="bg-border space-y-[1px]">
        {filtered.map(d => (
          <div
            key={d.id}
            className={`grid ${DEPLOY_COLS} gap-3 py-3.5 px-0 bg-black items-center hover:bg-surface transition-colors duration-150 group`}
          >
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
  );
};
