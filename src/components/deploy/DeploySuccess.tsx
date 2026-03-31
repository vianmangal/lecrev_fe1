import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, LoaderCircle, TerminalSquare } from 'lucide-react';
import { CyanBtn, GhostBtn } from '../UI';
import {
  ApiConnection,
  BuildJob,
  ExecutionJob,
  FunctionVersion,
  HTTPTrigger,
  LiveDeploymentRecord,
  createHTTPTrigger,
  getBuildJob,
  getBuildJobLogs,
  getFunctionVersion,
  getJob,
  getJobLogs,
  getJobOutput,
  listHTTPTriggers,
  sleep,
} from '../../api';

export function DeploySuccess({
  connection,
  deploymentId,
  versionId,
  buildJobId,
  record,
  onReset,
  onViewDeployments,
}: {
  connection: ApiConnection;
  deploymentId: string;
  versionId: string;
  buildJobId?: string;
  record: LiveDeploymentRecord | null;
  onReset: () => void;
  onViewDeployments: () => void;
}) {
  const [version, setVersion] = useState<FunctionVersion | undefined>(record?.version);
  const [buildJob, setBuildJob] = useState<BuildJob | undefined>(record?.buildJob);
  const [job, setJob] = useState<ExecutionJob | undefined>(record?.job);
  const [buildLogs, setBuildLogs] = useState<string | undefined>(record?.buildLogs);
  const [jobLogs, setJobLogs] = useState<string | undefined>(record?.jobLogs);
  const [jobOutput, setJobOutput] = useState<unknown>(record?.jobOutput);
  const [functionURL, setFunctionURL] = useState<HTTPTrigger | undefined>(record?.functionURLs?.[0]);
  const [monitorError, setMonitorError] = useState<string | null>(record?.error ?? null);

  useEffect(() => {
    if (record?.version) setVersion(record.version);
    if (record?.buildJob) setBuildJob(record.buildJob);
    if (record?.job) setJob(record.job);
    if (record?.buildLogs) setBuildLogs(record.buildLogs);
    if (record?.jobLogs) setJobLogs(record.jobLogs);
    if (record?.jobOutput !== undefined) setJobOutput(record.jobOutput);
    if (record?.functionURLs?.[0]) setFunctionURL(record.functionURLs[0]);
    if (record?.error) setMonitorError(record.error);
  }, [record]);

  useEffect(() => {
    if (!versionId) return;

    let cancelled = false;

    void (async () => {
      let activeBuildJobId = buildJobId ?? record?.buildJob?.id;
      let activeJobId = record?.job?.id;
      let triggerAttempted = false;

      while (!cancelled) {
        try {
          const nextVersion = await getFunctionVersion(connection, versionId);
          if (cancelled) return;
          setVersion(nextVersion);
          activeBuildJobId = activeBuildJobId ?? nextVersion.buildJobId;
          let nextBuildState: BuildJob | undefined;
          let nextJobState: ExecutionJob | undefined;
          let nextFunctionURL: HTTPTrigger | undefined;

          if (activeBuildJobId) {
            nextBuildState = await getBuildJob(connection, activeBuildJobId);
            if (cancelled) return;
            setBuildJob(nextBuildState);
            const nextBuildLogs = await getBuildJobLogs(connection, activeBuildJobId).catch(() => undefined);
            if (!cancelled && nextBuildLogs) setBuildLogs(nextBuildLogs);
          }

          if (nextVersion.state === 'ready') {
            const existingTriggers = await listHTTPTriggers(connection, versionId).catch(() => [] as HTTPTrigger[]);
            if (cancelled) return;
            if (existingTriggers.length > 0) {
              nextFunctionURL = existingTriggers[0];
              setFunctionURL(nextFunctionURL);
            } else if (!triggerAttempted) {
              triggerAttempted = true;
              const created = await createHTTPTrigger(connection, versionId, {
                description: 'Default function URL',
                authMode: 'none',
              }).catch(() => null);
              if (!cancelled && created) {
                nextFunctionURL = created;
                setFunctionURL(created);
              }
            }
          }

          activeJobId = record?.job?.id ?? activeJobId;
          if (activeJobId) {
            nextJobState = await getJob(connection, activeJobId);
            if (cancelled) return;
            setJob(nextJobState);
            const nextJobLogs = await getJobLogs(connection, activeJobId).catch(() => undefined);
            if (!cancelled && nextJobLogs) setJobLogs(nextJobLogs);
            if (nextJobState.state === 'succeeded') {
              const output = await getJobOutput(connection, activeJobId).catch(() => undefined);
              if (!cancelled && output !== undefined) setJobOutput(output);
            }
          }

          const buildTerminal = !activeBuildJobId || nextBuildState?.state === 'succeeded' || nextBuildState?.state === 'failed';
          const jobTerminal = !activeJobId || nextJobState?.state === 'succeeded' || nextJobState?.state === 'failed';
          const versionTerminal = nextVersion.state === 'ready' || nextVersion.state === 'failed';

          if (versionTerminal && buildTerminal && jobTerminal && (nextFunctionURL || nextVersion.state !== 'ready')) {
            return;
          }
        } catch (err) {
          if (!cancelled) setMonitorError(err instanceof Error ? err.message : 'Unable to monitor deployment.');
          return;
        }

        await sleep(1200);
      }
    })();

    return () => { cancelled = true; };
  }, [buildJobId, connection, record, versionId]);

  const effectiveVersion = version ?? record?.version;
  const effectiveBuildJob = buildJob ?? record?.buildJob;
  const effectiveJob = job ?? record?.job;
  const effectiveError = monitorError ?? record?.error ?? null;

  const hasFailed = Boolean(
    effectiveError ||
    effectiveBuildJob?.state === 'failed' ||
    effectiveVersion?.state === 'failed' ||
    effectiveJob?.state === 'failed',
  );
  const isActive = effectiveJob?.state === 'succeeded';
  const isWarmPending = !effectiveJob && effectiveBuildJob?.state === 'succeeded' && effectiveVersion?.state === 'ready';

  const statusLabel = hasFailed
    ? 'Deployment Failed'
    : isActive
      ? 'Deployment Active'
      : effectiveJob
        ? 'Executing Function'
        : isWarmPending
          ? 'Warming Function'
          : effectiveBuildJob || effectiveVersion?.state === 'building'
          ? 'Building Deployment'
          : 'Deployment Queued';

  const latestLogs = jobLogs?.trim() || buildLogs?.trim() || effectiveError || '';
  const logTitle = jobLogs?.trim()
    ? 'Execution Logs'
    : buildLogs?.trim()
      ? 'Build Logs'
      : effectiveError
        ? 'Error'
        : '';

  const statusRows: Array<[string, string]> = [
    ['Build', effectiveBuildJob?.state ?? 'queued'],
    ['Version', effectiveVersion?.state ?? 'queued'],
    ['Execution', effectiveJob?.state ?? (isWarmPending ? 'warming' : 'waiting')],
    ...(effectiveJob?.result?.latencyMs ? [['Latency', `${effectiveJob.result.latencyMs} ms`] as [string, string]] : []),
  ];

  const formattedOutput = useMemo(() => {
    if (jobOutput === undefined) return '';
    try {
      return JSON.stringify(jobOutput, null, 2);
    } catch {
      return String(jobOutput);
    }
  }, [jobOutput]);

  const statusColor = hasFailed
    ? 'border-red-500 text-red-500'
    : isActive
      ? 'border-cyan-primary text-cyan-primary'
      : 'border-amber-400 text-amber-400';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 md:mb-12">
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${statusColor}`}>
          {hasFailed
            ? <AlertTriangle size={18} />
            : isActive
              ? <CheckCircle2 size={18} />
              : <LoaderCircle size={18} className="animate-spin" />}
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tighter font-normal">
            {statusLabel}
          </h2>
          <p className="text-[10px] uppercase tracking-[0.15em] text-sub mt-1">{deploymentId}</p>
        </div>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-8 md:mb-12">
        {statusRows.map(([key, value]) => (
          <div key={key}>
            <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1.5">{key}</p>
            <p className="text-[13px]">{value}</p>
          </div>
        ))}
      </div>

      {/* Function URL */}
      <div className="border border-border bg-surface/40 p-4 sm:p-5 mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-primary mb-2">Function URL</p>
            {functionURL ? (
              <p className="text-sm text-white break-all">{functionURL.url}</p>
            ) : (
              <p className="text-sm text-sub">
                {effectiveVersion?.state === 'ready'
                  ? 'Generating function URL…'
                  : 'Function URL will be created once the build and warm preparation are ready.'}
              </p>
            )}
          </div>
          {functionURL && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <GhostBtn small onClick={() => { window.navigator.clipboard.writeText(functionURL.url).catch(() => undefined); }}>
                Copy URL
              </GhostBtn>
              <GhostBtn small onClick={() => { window.open(functionURL.url, '_blank', 'noopener,noreferrer'); }}>
                Open URL
              </GhostBtn>
            </div>
          )}
        </div>
      </div>

      {/* Logs */}
      {latestLogs ? (
        <div className="border border-border mb-8">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border text-sub text-[10px] uppercase tracking-[0.15em]">
            <TerminalSquare size={12} />
            <span>{logTitle}</span>
          </div>
          <pre className="overflow-auto max-h-72 p-4 text-[11px] leading-5 text-neutral-200 whitespace-pre-wrap break-all">
            {latestLogs}
          </pre>
        </div>
      ) : (
        <div className="border border-border px-4 py-5 mb-8 text-[11px] text-sub">
          {isWarmPending ? 'Waiting for warm preparation to finish before the first execution…' : 'Waiting for build or execution logs…'}
        </div>
      )}

      {/* Function output */}
      {formattedOutput && (
        <div className="border border-border mb-8">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border text-sub text-[10px] uppercase tracking-[0.15em]">
            <TerminalSquare size={12} />
            <span>Function Output</span>
          </div>
          <pre className="overflow-auto max-h-56 p-4 text-[11px] leading-5 text-neutral-200 whitespace-pre-wrap break-all">
            {formattedOutput}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <GhostBtn onClick={onReset}>New Deployment</GhostBtn>
        <CyanBtn onClick={onViewDeployments}>View Deployments →</CyanBtn>
      </div>
    </motion.div>
  );
}
