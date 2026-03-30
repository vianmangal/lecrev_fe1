import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, LoaderCircle, TerminalSquare } from 'lucide-react';
import { CyanBtn, GhostBtn } from '../UI';
import { LiveDeploymentRecord } from '../../api';

export function DeploySuccess({
  deploymentId,
  record,
  onReset,
  onViewDeployments,
}: {
  deploymentId: string;
  record: LiveDeploymentRecord | null;
  onReset: () => void;
  onViewDeployments: () => void;
}) {
  const hasFailed = Boolean(
    record?.error ||
    record?.buildJob?.state === 'failed' ||
    record?.version.state === 'failed' ||
    record?.job?.state === 'failed',
  );
  const isActive = record?.job?.state === 'succeeded';
  const isRunning = !hasFailed && !isActive;

  const statusLabel = hasFailed
    ? 'Deployment Failed'
    : isActive
      ? 'Deployment Active'
      : record?.job
        ? 'Executing Function'
        : record?.buildJob || record?.version.state === 'building'
          ? 'Building Deployment'
          : 'Deployment Queued';

  const latestLogs = record?.jobLogs?.trim() || record?.buildLogs?.trim() || record?.error || '';
  const logTitle = record?.jobLogs?.trim()
    ? 'Execution Logs'
    : record?.buildLogs?.trim()
      ? 'Build Logs'
      : record?.error
        ? 'Error'
        : '';

  const statusRows = [
    ['Build', record?.buildJob?.state ?? 'queued'],
    ['Version', record?.version.state ?? 'queued'],
    ['Execution', record?.job?.state ?? 'waiting'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-10"
    >
      <div className={`w-14 h-14 rounded-full border flex items-center justify-center ${hasFailed ? 'border-red-500 text-red-500' : isActive ? 'border-cyan-primary text-cyan-primary' : 'border-amber-400 text-amber-400'}`}>
        {hasFailed ? <AlertTriangle size={30} /> : isActive ? <CheckCircle2 size={32} /> : <LoaderCircle size={30} className="animate-spin" />}
      </div>
      <p className="text-sm uppercase tracking-[0.1em]">{statusLabel}</p>
      <p className="text-[11px] text-sub">{deploymentId}</p>

      <div className="w-full max-w-[720px] border border-border bg-surface/40 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statusRows.map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1.5">{label}</p>
              <p className="text-[12px] uppercase tracking-[0.08em]">{value}</p>
            </div>
          ))}
        </div>

        {record?.job?.result?.latencyMs ? (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1.5">Latency</p>
            <p className="text-[12px]">{record.job.result.latencyMs} ms</p>
          </div>
        ) : null}

        {latestLogs ? (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3 text-sub text-[10px] uppercase tracking-[0.15em]">
              <TerminalSquare size={12} />
              <span>{logTitle}</span>
            </div>
            <pre className="max-h-[260px] overflow-auto bg-black/50 border border-border p-4 text-[11px] leading-5 text-neutral-200 whitespace-pre-wrap break-all">
              {latestLogs}
            </pre>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-border text-[11px] text-sub">
            Waiting for build or execution logs…
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
        <GhostBtn className="w-full sm:w-auto" onClick={onReset}>New Deployment</GhostBtn>
        <CyanBtn className="w-full sm:w-auto" onClick={onViewDeployments}>View Deployments →</CyanBtn>
      </div>
    </motion.div>
  );
}
