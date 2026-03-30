import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { CyanBtn, GhostBtn } from '../UI';

export function DeploySuccess({
  deploymentId,
  onReset,
  onViewDeployments,
}: {
  deploymentId: string;
  onReset: () => void;
  onViewDeployments: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 px-4"
    >
      <div className="w-14 h-14 rounded-full border border-cyan-primary flex items-center justify-center text-cyan-primary">
        <CheckCircle2 size={32} />
      </div>
      <p className="text-sm uppercase tracking-[0.1em]">Deployment Queued</p>
      <p className="text-[11px] text-sub">{deploymentId}</p>
      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
        <GhostBtn className="w-full sm:w-auto" onClick={onReset}>New Deployment</GhostBtn>
        <CyanBtn className="w-full sm:w-auto" onClick={onViewDeployments}>View Deployments →</CyanBtn>
      </div>
    </motion.div>
  );
}
