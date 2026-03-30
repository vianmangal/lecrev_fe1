import React from 'react';
import { motion } from 'motion/react';
import { Deployment, Project } from './types';
import { ProjectList } from './components/projects/ProjectList';
import { FilterButton } from './components/deployments/FilterButton';
import { DeploymentTable } from './components/deployments/DeploymentTable';

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

      <ProjectList projects={projects} onViewProject={onViewProject} />
    </motion.div>
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
        <FilterButton value="All" current={envF} onChange={setEnvF} />
        <FilterButton value="Production" current={envF} onChange={setEnvF} />
        <FilterButton value="Staging" current={envF} onChange={setEnvF} />
        <div className="w-full sm:w-auto sm:ml-auto flex gap-2 flex-wrap">
          {['Active', 'Building', 'Ready', 'Failed'].map((s) => (
            <FilterButton key={s} value={s} current={statusF} onChange={setStatusF} />
          ))}
        </div>
      </div>

      <DeploymentTable deployments={filtered} emptyLabel="No deployments yet" />
    </motion.div>
  );
};
