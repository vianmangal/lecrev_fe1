import React from 'react';
import { motion } from 'motion/react';
import { Deployment, Project } from './types';
import { ProjectList } from './components/projects/ProjectList';
import { DeploymentTable } from './components/deployments/DeploymentTable';
import { PageLayout } from './components/layout/PageLayout';

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
      className="flex-1"
    >
      <PageLayout
        title="Projects"
        count={projects.length}
        totalCount={projects.length}
        showFilterPlaceholder
      >
        <ProjectList projects={projects} onViewProject={onViewProject} />
      </PageLayout>
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
      className="flex-1"
    >
      <PageLayout
        title="Deployments"
        count={filtered.length}
        totalCount={deployments.length}
        filters={[
          {
            id: 'env',
            current: envF,
            onChange: setEnvF,
            options: ['All', 'Production', 'Staging'],
          },
        ]}
        statusFilters={[
          {
            id: 'status',
            current: statusF,
            onChange: setStatusF,
            options: ['Active', 'Building', 'Ready', 'Failed'],
          },
        ]}
      >
        <DeploymentTable deployments={filtered} emptyLabel="No deployments yet" />
      </PageLayout>
    </motion.div>
  );
};
