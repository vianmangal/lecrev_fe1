import React from 'react';
import { StatusBadge } from '../UI';
import { Project } from '../../types';

interface ProjectListProps {
  projects: Project[];
  onViewProject: (project: Project) => void;
}

export function ProjectList({ projects, onViewProject }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[11px] text-sub uppercase tracking-[0.12em]">
        No projects yet
      </div>
    );
  }

  return (
    <div className="bg-border mt-0 space-y-[1px]">
      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() => onViewProject(project)}
          className="group bg-black flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-surface transition-colors duration-150"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] mb-1 group-hover:text-cyan-primary transition-colors duration-150 truncate">{project.name}</p>
            <p className="text-[9px] uppercase tracking-[0.15em] text-muted truncate">{project.url}</p>
          </div>
          <div className="flex items-center gap-6 sm:gap-12 ml-4 shrink-0">
            <div className="text-right">
              <StatusBadge status={project.status} />
              <p className="text-[9px] uppercase tracking-[0.15em] text-muted mt-1">
                {project.active ? 'Active · ' : ''}{project.instances}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
