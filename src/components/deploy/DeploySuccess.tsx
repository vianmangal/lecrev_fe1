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
    if (record?.version) {
      setVersion(record.version);
    }
    if (record?.buildJob) {
      setBuildJob(record.buildJob);
    }
    if (record?.job) {
      setJob(record.job);
    }
    if (record?.buildLogs) {
      setBuildLogs(record.buildLogs);
    }
    if (record?.jobLogs) {
      setJobLogs(record.jobLogs);
    }
    if (record?.jobOutput !== undefined) {
      setJobOutput(record.jobOutput);
    }
    if (record?.functionURLs?.[0]) {
      setFunctionURL(record.functionURLs[0]);
    }
    if (record?.error) {
      setMonitorError(record.error);
    }
  }, [record]);

  useEffect(() => {
    if (!versionId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let activeBuildJobId = buildJobId ?? record?.buildJob?.id;
      let activeJobId = record?.job?.id;
      let triggerAttempted = false;

      while (!cancelled) {
        try {
          const nextVersion = await getFunctionVersion(connection, versionId);
          if (cancelled) {
            return;
          }
          setVersion(nextVersion);
          activeBuildJobId = activeBuildJobId ?? nextVersion.buildJobId;
          let nextBuildState: BuildJob | undefined;
          let nextJobState: ExecutionJob | undefined;
          let nextFunctionURL: HTTPTrigger | undefined;

          if (activeBuildJobId) {
            nextBuildState = await getBuildJob(connection, activeBuildJobId);
            if (cancelled) {
              return;
            }
            setBuildJob(nextBuildState);
            const nextBuildLogs = await getBuildJobLogs(connection, activeBuildJobId).catch(() => undefined);
            if (!cancelled && nextBuildLogs) {
              setBuildLogs(nextBuildLogs);
            }
          }

          if (nextVersion.state === 'ready') {
            const existingTriggers = await listHTTPTriggers(connection, versionId).catch(() => [] as HTTPTrigger[]);
            if (cancelled) {
              return;
            }
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
            if (cancelled) {
              return;
            }
            setJob(nextJobState);
            const nextJobLogs = await getJobLogs(connection, activeJobId).catch(() => undefined);
            if (!cancelled && nextJobLogs) {
              setJobLogs(nextJobLogs);
            }
            if (nextJobState.state === 'succeeded') {
              const output = await getJobOutput(connection, activeJobId).catch(() => undefined);
              if (!cancelled && output !== undefined) {
                setJobOutput(output);
              }
            }
          }

          const buildTerminal = !activeBuildJobId || nextBuildState?.state === 'succeeded' || nextBuildState?.state === 'failed';
          const jobTerminal = !activeJobId || nextJobState?.state === 'succeeded' || nextJobState?.state === 'failed';
          const versionTerminal = nextVersion.state === 'ready' || nextVersion.state === 'failed';

          if (versionTerminal && buildTerminal && jobTerminal && (nextFunctionURL || nextVersion.state !== 'ready')) {
            return;
          }
        } catch (err) {
          if (!cancelled) {
            setMonitorError(err instanceof Error ? err.message : 'Unable to monitor deployment.');
          }
          return;
        }

        await sleep(1200);
      }
    })();

    return () => {
      cancelled = true;
    };
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
  const isRunning = !hasFailed && !isActive;

  const statusLabel = hasFailed
    ? 'Deployment Failed'
    : isActive
      ? 'Deployment Active'
      : effectiveJob
        ? 'Executing Function'
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

  const statusRows = [
    ['Build', effectiveBuildJob?.state ?? 'queued'],
    ['Version', effectiveVersion?.state ?? 'queued'],
    ['Execution', effectiveJob?.state ?? 'waiting'],
  ];

  const formattedOutput = useMemo(() => {
    if (jobOutput === undefined) {
      return '';
    }
    try {
      return JSON.stringify(jobOutput, null, 2);
    } catch {
      return String(jobOutput);
    }
  }, [jobOutput]);

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

        {effectiveJob?.result?.latencyMs ? (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1.5">Latency</p>
            <p className="text-[12px]">{effectiveJob.result.latencyMs} ms</p>
          </div>
        ) : null}

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1.5">Function URL</p>
          {functionURL ? (
            <div className="flex flex-col gap-3">
              <p className="text-[12px] break-all">{functionURL.url}</p>
              <div className="flex flex-wrap gap-2">
                <GhostBtn
                  small
                  onClick={() => {
                    window.navigator.clipboard.writeText(functionURL.url).catch(() => undefined);
                  }}
                >
                  Copy URL
                </GhostBtn>
                <GhostBtn
                  small
                  onClick={() => {
                    window.open(functionURL.url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Open URL
                </GhostBtn>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-sub">
              {effectiveVersion?.state === 'ready' ? 'Generating function URL…' : 'Function URL will be created once the build is ready.'}
            </p>
          )}
        </div>

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

        {formattedOutput ? (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3 text-sub text-[10px] uppercase tracking-[0.15em]">
              <TerminalSquare size={12} />
              <span>Function Output</span>
            </div>
            <pre className="max-h-[220px] overflow-auto bg-black/50 border border-border p-4 text-[11px] leading-5 text-neutral-200 whitespace-pre-wrap break-all">
              {formattedOutput}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
        <GhostBtn className="w-full sm:w-auto" onClick={onReset}>New Deployment</GhostBtn>
        <CyanBtn className="w-full sm:w-auto" onClick={onViewDeployments}>View Deployments →</CyanBtn>
      </div>
    </motion.div>
  );
}
