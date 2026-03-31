import React from 'react';
import { motion } from 'motion/react';
import { StatusBadge } from '../UI';
import { Project } from '../../types';

interface ProjectListProps {
  projects: Project[];
  onViewProject: (project: Project) => void;
}

export function ProjectList({ projects, onViewProject }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-[13px] text-white mb-1">No projects yet</p>
        <p className="text-[11px] text-sub">Deploy your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[1px] bg-border mt-0">
      {projects.map((project, index) => (
        <motion.div
          key={project.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.2 }}
          onClick={() => onViewProject(project)}
          className="group bg-black flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-surface transition-colors duration-150"
        >
          <div className="min-w-0 flex-1 mb-3 sm:mb-0">
            <p className="text-[13px] sm:text-[14px] mb-1 group-hover:text-cyan-primary transition-colors duration-150 truncate font-medium">{project.name}</p>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-muted truncate">{project.url}</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-12 shrink-0">
            <div className="text-left sm:text-right">
              <StatusBadge status={project.status} />
              <p className="text-[9px] uppercase tracking-[0.15em] text-muted mt-1">
                {project.active ? 'Active · ' : ''}{project.instances}
              </p>
            </div>
            <div className="text-muted group-hover:text-cyan-primary transition-colors sm:block">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
