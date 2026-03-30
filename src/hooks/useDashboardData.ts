import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEPLOYS, PROJECTS } from '../constants';
import { authClient } from '../lib/auth-client';
import {
  ApiConnection,
  DeployRequestInput,
  DeploymentSummary,
  LiveDeploymentRecord,
  ProjectRecord,
  createFunctionVersion,
  getBuildJob,
  getBuildJobLogs,
  getFunctionVersion,
  getJob,
  getJobLogs,
  getJobOutput,
  invokeFunction,
  listDeployments,
  listProjects,
  listRegions,
  sleep,
  summaryToDeploymentRow,
  toDeploymentRow,
} from '../api';
import { Deployment, Project } from '../types';
import {
  DEFAULT_CONNECTION,
  FALLBACK_REGIONS,
  buildProjectRow,
  loadConnection,
  mergeDeploymentRows,
  persistConnection,
} from '../lib/dashboard-utils';

export function useDashboardData() {
  const [connection, setConnection] = useState<ApiConnection>(() => loadConnection());
  const [availableRegions, setAvailableRegions] = useState<string[]>(FALLBACK_REGIONS);
  const [liveDeployments, setLiveDeployments] = useState<LiveDeploymentRecord[]>([]);
  const [backendProjects, setBackendProjects] = useState<ProjectRecord[]>([]);
  const [backendDeployments, setBackendDeployments] = useState<DeploymentSummary[]>([]);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);
  const { data: sessionData, isPending: isSessionPending, refetch: refetchSession } = authClient.useSession();

  const activeUser = sessionData?.user ?? null;
  const authRequired = githubConfigured === true && !isSessionPending && !activeUser;

  useEffect(() => {
    persistConnection(connection);
  }, [connection]);

  useEffect(() => {
    let cancelled = false;

    void fetch('/health/auth')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Auth health check failed with ${response.status}`);
        }
        return response.json() as Promise<{ githubConfigured?: boolean }>;
      })
      .then((data) => {
        if (!cancelled) {
          setGithubConfigured(typeof data.githubConfigured === 'boolean' ? data.githubConfigured : false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGithubConfigured(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshCatalog = useCallback(async (conn: ApiConnection) => {
    const [regionsResult, projectsResult, deploymentsResult] = await Promise.allSettled([
      listRegions(conn),
      listProjects(conn),
      listDeployments(conn, { limit: 50 }),
    ]);

    let nextError: string | null = null;

    if (regionsResult.status === 'fulfilled') {
      setAvailableRegions(regionsResult.value.length > 0 ? regionsResult.value.map((row) => row.name) : FALLBACK_REGIONS);
    } else {
      setAvailableRegions(FALLBACK_REGIONS);
      nextError = regionsResult.reason instanceof Error ? regionsResult.reason.message : 'Unable to load region catalog.';
    }

    if (projectsResult.status === 'fulfilled') {
      setBackendProjects(projectsResult.value);
    } else {
      setBackendProjects([]);
      nextError ??= projectsResult.reason instanceof Error ? projectsResult.reason.message : 'Unable to load projects.';
    }

    if (deploymentsResult.status === 'fulfilled') {
      setBackendDeployments(deploymentsResult.value);
    } else {
      setBackendDeployments([]);
      nextError ??= deploymentsResult.reason instanceof Error ? deploymentsResult.reason.message : 'Unable to load deployments.';
    }

    setIntegrationError(nextError);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshCatalog(connection);
      if (cancelled) {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection.baseUrl, connection.apiKey, refreshCatalog]);

  const patchLiveDeployment = useCallback((versionId: string, updater: (record: LiveDeploymentRecord) => LiveDeploymentRecord) => {
    setLiveDeployments((prev) =>
      prev.map((record) => (record.version.id === versionId ? updater(record) : record)),
    );
  }, []);

  const trackExecutionLifecycle = useCallback(async (conn: ApiConnection, versionId: string, jobId: string) => {
    try {
      while (true) {
        const job = await getJob(conn, jobId);
        patchLiveDeployment(versionId, (record) => ({
          ...record,
          job,
          error: job.state === 'failed' ? job.error || record.error : record.error,
        }));

        if (job.state === 'succeeded' || job.state === 'failed') {
          const [jobLogs, jobOutput] = await Promise.all([
            getJobLogs(conn, jobId).catch(() => undefined),
            getJobOutput(conn, jobId).catch(() => undefined),
          ]);
          patchLiveDeployment(versionId, (record) => ({
            ...record,
            job,
            jobLogs: jobLogs ?? record.jobLogs,
            jobOutput: jobOutput ?? record.jobOutput,
          }));
          break;
        }
        await sleep(1200);
      }
    } catch (err) {
      patchLiveDeployment(versionId, (record) => ({
        ...record,
        error: err instanceof Error ? err.message : 'Execution polling failed.',
      }));
    } finally {
      await refreshCatalog(conn);
    }
  }, [patchLiveDeployment, refreshCatalog]);

  const startExecution = useCallback(async (conn: ApiConnection, versionId: string) => {
    try {
      const job = await invokeFunction(conn, versionId, {
        source: 'lecrev_frontend',
        mode: 'wireframe',
        submittedAt: new Date().toISOString(),
      });
      patchLiveDeployment(versionId, (record) => ({
        ...record,
        job,
      }));
      await trackExecutionLifecycle(conn, versionId, job.id);
    } catch (err) {
      patchLiveDeployment(versionId, (record) => ({
        ...record,
        error: err instanceof Error ? err.message : 'Execution submission failed.',
      }));
      await refreshCatalog(conn);
    }
  }, [patchLiveDeployment, refreshCatalog, trackExecutionLifecycle]);

  const trackBuildLifecycle = useCallback(async (conn: ApiConnection, versionId: string, buildJobId: string) => {
    let lastBuildState: LiveDeploymentRecord['buildJob'];
    let lastVersionState: LiveDeploymentRecord['version'] | undefined;
    try {
      while (true) {
        const [buildJob, version] = await Promise.all([
          getBuildJob(conn, buildJobId),
          getFunctionVersion(conn, versionId),
        ]);
        lastBuildState = buildJob;
        lastVersionState = version;
        patchLiveDeployment(versionId, (record) => ({
          ...record,
          version,
          buildJob,
          error: buildJob.state === 'failed' || version.state === 'failed' ? buildJob.error || record.error : record.error,
        }));

        if (buildJob.state === 'failed' || version.state === 'failed') {
          break;
        }
        if (buildJob.state === 'succeeded' && version.state === 'ready') {
          break;
        }
        await sleep(1200);
      }

      const buildLogs = await getBuildJobLogs(conn, buildJobId).catch(() => undefined);
      if (buildLogs) {
        patchLiveDeployment(versionId, (record) => ({
          ...record,
          buildLogs,
        }));
      }

      if (!lastBuildState || !lastVersionState) {
        return;
      }
      if (lastBuildState.state !== 'succeeded' || lastVersionState.state !== 'ready') {
        return;
      }

      await startExecution(conn, versionId);
    } catch (err) {
      patchLiveDeployment(versionId, (record) => ({
        ...record,
        error: err instanceof Error ? err.message : 'Build polling failed.',
      }));
    } finally {
      await refreshCatalog(conn);
    }
  }, [patchLiveDeployment, refreshCatalog, startExecution]);

  const handleDeploy = useCallback(async (request: DeployRequestInput) => {
    try {
      setIntegrationError(null);
      const conn = { ...connection };
      const version = await createFunctionVersion(conn, request);

      setLiveDeployments((prev) => [
        {
          projectId: request.projectId,
          environment: request.environment,
          version,
        },
        ...prev.filter((record) => record.version.id !== version.id),
      ]);

      await refreshCatalog(conn);

      if (version.buildJobId) {
        void trackBuildLifecycle(conn, version.id, version.buildJobId);
      } else if (version.state === 'ready') {
        void startExecution(conn, version.id);
      }

      return {
        versionId: version.id,
        buildJobId: version.buildJobId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed.';
      setIntegrationError(message);
      throw err;
    }
  }, [connection, refreshCatalog, startExecution, trackBuildLifecycle]);

  const deploymentRows = useMemo<Deployment[]>(() => (
    mergeDeploymentRows(backendDeployments, liveDeployments, DEPLOYS, summaryToDeploymentRow, toDeploymentRow)
  ), [backendDeployments, liveDeployments]);

  const deploymentIDsByProject = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const summary of backendDeployments) {
      const current = map.get(summary.projectId) ?? [];
      current.push(summary.id);
      map.set(summary.projectId, current);
    }

    for (const record of liveDeployments) {
      const current = map.get(record.projectId) ?? [];
      if (!current.includes(record.version.id)) {
        current.unshift(record.version.id);
      }
      map.set(record.projectId, current);
    }

    return map;
  }, [backendDeployments, liveDeployments]);

  const projectRows = useMemo<Project[]>(() => {
    const deploymentsByProject = new Map<string, Deployment[]>();
    const projectNames = new Map<string, string>();

    for (const summary of backendDeployments) {
      const current = deploymentsByProject.get(summary.projectId) ?? [];
      current.push(summaryToDeploymentRow(summary));
      deploymentsByProject.set(summary.projectId, current);
      projectNames.set(summary.projectId, summary.projectName || summary.projectId);
    }

    for (const record of liveDeployments) {
      const current = deploymentsByProject.get(record.projectId) ?? [];
      current.unshift(toDeploymentRow(record));
      deploymentsByProject.set(record.projectId, current);
      if (!projectNames.has(record.projectId)) {
        projectNames.set(record.projectId, record.projectId);
      }
    }

    const map = new Map<string, Project>();

    for (const project of backendProjects) {
      map.set(
        project.id,
        buildProjectRow(
          project.id,
          project.name || projectNames.get(project.id) || project.id,
          deploymentsByProject.get(project.id) ?? [],
        ),
      );
    }

    for (const [projectID, rows] of deploymentsByProject.entries()) {
      if (!map.has(projectID)) {
        map.set(projectID, buildProjectRow(projectID, projectNames.get(projectID) || projectID, rows));
      }
    }

    for (const project of PROJECTS) {
      if (!map.has(project.id)) {
        map.set(project.id, project);
      }
    }

    return Array.from(map.values());
  }, [backendDeployments, backendProjects, liveDeployments]);

  const saveConnection = useCallback((next: ApiConnection) => {
    setConnection({
      baseUrl: next.baseUrl.trim(),
      apiKey: next.apiKey.trim() || DEFAULT_CONNECTION.apiKey,
      projectId: next.projectId.trim() || DEFAULT_CONNECTION.projectId,
    });
    setIntegrationError(null);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await authClient.signOut();
      await refetchSession();
    } catch (err) {
      setIntegrationError(err instanceof Error ? err.message : 'Unable to sign out.');
    }
  }, [refetchSession]);

  return {
    connection,
    availableRegions,
    liveDeployments,
    integrationError,
    githubConfigured,
    activeUser,
    isSessionPending,
    authRequired,
    projectRows,
    deploymentRows,
    deploymentIDsByProject,
    handleDeploy,
    handleSignOut,
    refreshCatalog,
    saveConnection,
    setIntegrationError,
    refetchSession,
  };
}
