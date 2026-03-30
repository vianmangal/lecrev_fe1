import React from 'react';
import { StatusBadge } from '../UI';
import { Deployment } from '../../types';

const DEPLOYMENT_COLUMNS = ['Deployment', 'Project', 'Branch', 'Commit', 'Environment', 'Status', 'Age'];
const DEPLOYMENT_GRID = 'grid-cols-[1.8fr_1.4fr_1.1fr_1fr_1.1fr_1.1fr_0.7fr]';

interface DeploymentTableProps {
  deployments: Deployment[];
  emptyLabel: string;
  limit?: number;
}

export function DeploymentTable({ deployments, emptyLabel, limit }: DeploymentTableProps) {
  const rows = typeof limit === 'number' ? deployments.slice(0, limit) : deployments;

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className={`grid ${DEPLOYMENT_GRID} gap-3 pb-3 border-b border-border mb-[1px]`}>
          {DEPLOYMENT_COLUMNS.map((heading) => (
            <span key={heading} className="text-[10px] uppercase tracking-[0.15em] text-sub">{heading}</span>
          ))}
        </div>
        <div className="bg-border space-y-[1px]">
          {rows.map((deployment) => (
            <div
              key={deployment.id}
              className={`grid ${DEPLOYMENT_GRID} gap-3 py-3.5 px-0 bg-black items-center hover:bg-surface transition-colors duration-150 group`}
            >
              <span className="text-[10px] text-muted truncate">{deployment.id}</span>
              <span className="text-[12px] text-white group-hover:text-cyan-primary transition-colors duration-150">{deployment.project}</span>
              <span className="text-[11px] text-neutral-400">{deployment.branch}</span>
              <span className="text-[11px] text-neutral-400">{deployment.commit}</span>
              <StatusBadge status={deployment.env} />
              <StatusBadge status={deployment.status} />
              <span className="text-[11px] text-sub">{deployment.age}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
