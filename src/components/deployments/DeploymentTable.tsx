import React from 'react';
import { motion } from 'motion/react';
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
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <p className="text-[12px] text-sub">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="min-w-[700px]">
          <div className={`grid ${DEPLOYMENT_GRID} gap-3 pb-3 border-b border-border mb-[1px]`}>
            {DEPLOYMENT_COLUMNS.map((heading) => (
              <span key={heading} className="text-[10px] uppercase tracking-[0.15em] text-sub">{heading}</span>
            ))}
          </div>
          <div className="bg-border space-y-[1px]">
            {rows.map((deployment, index) => (
              <motion.div
                key={deployment.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`grid ${DEPLOYMENT_GRID} gap-3 py-3.5 px-0 bg-black items-center hover:bg-surface transition-colors duration-150 group`}
              >
                <span className="text-[10px] text-muted truncate">{deployment.id}</span>
                <span className="text-[12px] text-white group-hover:text-cyan-primary transition-colors duration-150">{deployment.project}</span>
                <span className="text-[11px] text-neutral-400">{deployment.branch}</span>
                <span className="text-[11px] text-neutral-400">{deployment.commit}</span>
                <StatusBadge status={deployment.env} />
                <StatusBadge status={deployment.status} />
                <span className="text-[11px] text-sub">{deployment.age}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {rows.map((deployment, index) => (
          <motion.div
            key={deployment.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-surface/50 border border-border p-4 rounded-lg"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-white font-medium truncate">{deployment.project}</p>
                <p className="text-[10px] text-muted truncate mt-0.5">{deployment.id}</p>
              </div>
              <StatusBadge status={deployment.status} />
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-muted block text-[9px] uppercase tracking-wider mb-0.5">Branch</span>
                <span className="text-neutral-300">{deployment.branch}</span>
              </div>
              <div>
                <span className="text-muted block text-[9px] uppercase tracking-wider mb-0.5">Commit</span>
                <span className="text-neutral-300">{deployment.commit}</span>
              </div>
              <div>
                <span className="text-muted block text-[9px] uppercase tracking-wider mb-0.5">Environment</span>
                <StatusBadge status={deployment.env} />
              </div>
              <div>
                <span className="text-muted block text-[9px] uppercase tracking-wider mb-0.5">Age</span>
                <span className="text-neutral-300">{deployment.age}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}
