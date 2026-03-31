import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '../lib/auth-client';
import {
  ApiConnection,
  DeployRequestInput,
  DeploymentSummary,
  HTTPTrigger,
  LiveDeploymentRecord,
  ProjectRecord,
  createProject as createBackendProject,
  createHTTPTrigger,
  createFunctionVersion,
  getBuildJob,
  getBuildJobLogs,
  getFunctionVersion,
  getFunctionWarmStatus,
  getJob,
  getJobLogs,
  getJobOutput,
  invokeFunction,
  listHTTPTriggers,
  listDeployments,
  listProjects,
  listRegions,
  normalizeEnvironment,
  sleep,
  summaryToDeploymentRow,
  toDeploymentRow,
} from '../api';
import { createGitHubDeploymentBinding } from '../lib/github-app';
import { Deployment, Project } from '../types';
import {
  DEFAULT_CONNECTION,
  FALLBACK_REGIONS,
  buildProjectRow,
  loadConnection,
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
  const [isConnectionPending, setIsConnectionPending] = useState(false);
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

  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    if (!activeUser) {
      setConnection((current) => ({
        baseUrl: current.baseUrl || DEFAULT_CONNECTION.baseUrl,
        apiKey: '',
        projectId: '',
      }));
      setBackendProjects([]);
      setBackendDeployments([]);
      setLiveDeployments([]);
      setAvailableRegions(FALLBACK_REGIONS);
      setIntegrationError(null);
      setIsConnectionPending(false);
      return;
    }

    let cancelled = false;
    setIsConnectionPending(true);

    void fetch('/api/lecrev/connection', {
      headers: {
        Accept: 'application/json',
      },
    })
      .then(async (response) => {
        const raw = await response.text();
        if (!response.ok) {
          throw new Error(raw.trim() || `Unable to load session connection (${response.status})`);
        }
        return raw ? JSON.parse(raw) as {
          connection?: Partial<ApiConnection>;
        } : {};
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setConnection((current) => ({
          baseUrl: current.baseUrl.trim() || payload.connection?.baseUrl?.trim() || DEFAULT_CONNECTION.baseUrl,
          apiKey: payload.connection?.apiKey?.trim() || '',
          projectId: current.projectId.trim() || payload.connection?.projectId?.trim() || '',
        }));
        setIntegrationError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setIntegrationError(err instanceof Error ? err.message : 'Unable to provision the session connection.');
          setConnection((current) => ({
            baseUrl: current.baseUrl || DEFAULT_CONNECTION.baseUrl,
            apiKey: '',
            projectId: '',
          }));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsConnectionPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeUser, isSessionPending]);

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
      setConnection((current) => {
        const selectedProjectId = current.projectId.trim();
        if (selectedProjectId && projectsResult.value.some((project) => project.id === selectedProjectId)) {
          return current;
        }
        return {
          ...current,
          projectId: projectsResult.value[0]?.id ?? '',
        };
      });
    } else {
      nextError ??= projectsResult.reason instanceof Error ? projectsResult.reason.message : 'Unable to load projects.';
    }

    if (deploymentsResult.status === 'fulfilled') {
      setBackendDeployments(deploymentsResult.value);
    } else {
      nextError ??= deploymentsResult.reason instanceof Error ? deploymentsResult.reason.message : 'Unable to load deployments.';
    }

    setIntegrationError(nextError);
  }, []);

  useEffect(() => {
    if (!activeUser || !connection.apiKey.trim()) {
      return;
    }
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
  }, [activeUser, connection.baseUrl, connection.apiKey, refreshCatalog]);

  const patchLiveDeployment = useCallback((versionId: string, updater: (record: LiveDeploymentRecord) => LiveDeploymentRecord) => {
    setLiveDeployments((prev) =>
      prev.map((record) => (record.version.id === versionId ? updater(record) : record)),
    );
  }, []);

  const loadFunctionURLs = useCallback(async (conn: ApiConnection, versionId: string): Promise<HTTPTrigger[]> => {
    const triggers = await listHTTPTriggers(conn, versionId);
    patchLiveDeployment(versionId, (record) => ({
      ...record,
      functionURLs: triggers,
    }));
    return triggers;
  }, [patchLiveDeployment]);

  const ensureFunctionURL = useCallback(async (conn: ApiConnection, versionId: string): Promise<HTTPTrigger | null> => {
    const existing = await loadFunctionURLs(conn, versionId).catch(() => [] as HTTPTrigger[]);
    if (existing.length > 0) {
      return existing[0];
    }

    const created = await createHTTPTrigger(conn, versionId, {
      description: 'Default function URL',
      authMode: 'none',
    });

    patchLiveDeployment(versionId, (record) => ({
      ...record,
      functionURLs: [created],
    }));
    return created;
  }, [loadFunctionURLs, patchLiveDeployment]);

  const trackExecutionLifecycle = useCallback(async (conn: ApiConnection, versionId: string, jobId: string) => {
    try {
      while (true) {
        const job = await getJob(conn, jobId);
        const jobLogs = await getJobLogs(conn, jobId).catch(() => undefined);
        patchLiveDeployment(versionId, (record) => ({
          ...record,
          job,
          jobLogs: jobLogs ?? record.jobLogs,
          error: job.state === 'failed' ? job.error || record.error : record.error,
        }));

        if (job.state === 'succeeded' || job.state === 'failed') {
          const jobOutput = await getJobOutput(conn, jobId).catch(() => undefined);
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

  const waitForFunctionWarmReady = useCallback(async (conn: ApiConnection, versionId: string) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const status = await getFunctionWarmStatus(conn, versionId);
      if (status.ready) {
        return status;
      }

      const hasActiveTargetRegion = status.regions.some((region) => region.state === 'active');
      if (!hasActiveTargetRegion) {
        return status;
      }

      await sleep(350);
    }
    return null;
  }, []);

  const trackBuildLifecycle = useCallback(async (conn: ApiConnection, versionId: string, buildJobId: string) => {
    let lastBuildState: LiveDeploymentRecord['buildJob'];
    let lastVersionState: LiveDeploymentRecord['version'] | undefined;
    try {
      while (true) {
        const [buildJob, version] = await Promise.all([
          getBuildJob(conn, buildJobId),
          getFunctionVersion(conn, versionId),
        ]);
        const buildLogs = await getBuildJobLogs(conn, buildJobId).catch(() => undefined);
        lastBuildState = buildJob;
        lastVersionState = version;
        patchLiveDeployment(versionId, (record) => ({
          ...record,
          version,
          buildJob,
          buildLogs: buildLogs ?? record.buildLogs,
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

      if (!lastBuildState || !lastVersionState) {
        return;
      }
      if (lastBuildState.state !== 'succeeded' || lastVersionState.state !== 'ready') {
        return;
      }

      await ensureFunctionURL(conn, versionId).catch(() => null);
      await waitForFunctionWarmReady(conn, versionId).catch(() => null);

      await startExecution(conn, versionId);
    } catch (err) {
      patchLiveDeployment(versionId, (record) => ({
        ...record,
        error: err instanceof Error ? err.message : 'Build polling failed.',
      }));
    } finally {
      await refreshCatalog(conn);
    }
  }, [ensureFunctionURL, patchLiveDeployment, refreshCatalog, startExecution, waitForFunctionWarmReady]);

  const handleDeploy = useCallback(async (request: DeployRequestInput) => {
    try {
      setIntegrationError(null);
      const conn = { ...connection };
      if (!conn.apiKey.trim() || !request.projectId.trim()) {
        throw new Error('Your Lecrev tenant connection is not ready yet. Refresh the page and try again.');
      }
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
        void ensureFunctionURL(conn, version.id).catch(() => undefined);
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

  const handleGitHubDeploy = useCallback(async (input: {
    installationId: number;
    owner: string;
    repo: string;
    repoFullName: string;
    gitUrl: string;
    gitRef: string;
    entrypoint: string;
    projectId: string;
    functionName: string;
    environment: 'production' | 'staging' | 'preview';
    region: string;
    envVars?: Record<string, string>;
  }) => {
    try {
      setIntegrationError(null);
      const conn = { ...connection };
      if (!conn.apiKey.trim()) {
        throw new Error('Your Lecrev tenant connection is not ready yet. Refresh the page and try again.');
      }
      if (!input.projectId.trim()) {
        throw new Error('Select a project before deploying from GitHub.');
      }

      const response = await createGitHubDeploymentBinding({
        installationId: input.installationId,
        owner: input.owner,
        repo: input.repo,
        repoFullName: input.repoFullName,
        gitUrl: input.gitUrl,
        gitRef: input.gitRef,
        entrypoint: input.entrypoint,
        projectId: input.projectId,
        functionName: input.functionName,
        environment: input.environment,
        region: input.region,
        envVars: input.envVars,
        autoDeploy: true,
        deployNow: true,
      });
      if (!response.deployment?.functionVersionId) {
        throw new Error('GitHub deployment binding was created, but no deployment was started.');
      }

      const version = await getFunctionVersion(conn, response.deployment.functionVersionId);
      setLiveDeployments((prev) => [
        {
          projectId: input.projectId,
          environment: normalizeEnvironment(input.environment),
          version,
        },
        ...prev.filter((record) => record.version.id !== version.id),
      ]);

      await refreshCatalog(conn);

      if (response.deployment.buildJobId) {
        void trackBuildLifecycle(conn, version.id, response.deployment.buildJobId);
      } else if (version.state === 'ready') {
        void ensureFunctionURL(conn, version.id).catch(() => undefined);
        void startExecution(conn, version.id);
      }

      return {
        versionId: version.id,
        buildJobId: response.deployment.buildJobId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub deployment failed.';
      setIntegrationError(message);
      throw err;
    }
  }, [connection, ensureFunctionURL, refreshCatalog, startExecution, trackBuildLifecycle]);

  const handleCreateProject = useCallback(async (input: { id?: string; name: string }) => {
    const conn = { ...connection };
    if (!conn.apiKey.trim()) {
      throw new Error('Your Lecrev tenant connection is not ready yet. Refresh the page and try again.');
    }
    const project = await createBackendProject(conn, input);
    setConnection((current) => ({
      ...current,
      projectId: project.id,
    }));
    await refreshCatalog(conn);
    return project;
  }, [connection, refreshCatalog]);

  const selectProject = useCallback((projectId: string) => {
    setConnection((current) => ({
      ...current,
      projectId: projectId.trim(),
    }));
    setIntegrationError(null);
  }, []);

  const deploymentRows = useMemo<Deployment[]>(() => {
    const map = new Map<string, Deployment>();
    const order: string[] = [];

    for (const summary of backendDeployments) {
      const row = summaryToDeploymentRow(summary);
      order.push(row.id);
      map.set(row.id, row);
    }

    for (const record of liveDeployments) {
      const row = toDeploymentRow(record);
      if (!map.has(row.id)) {
        order.unshift(row.id);
      }
      map.set(row.id, row);
    }

    return order
      .map((id) => map.get(id))
      .filter((row): row is Deployment => Boolean(row));
  }, [backendDeployments, liveDeployments]);

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

    return Array.from(map.values());
  }, [backendDeployments, backendProjects, liveDeployments]);

  const saveConnection = useCallback((next: ApiConnection) => {
    setConnection({
      baseUrl: next.baseUrl.trim(),
      apiKey: connection.apiKey,
      projectId: connection.projectId,
    });
    setIntegrationError(null);
  }, [connection.apiKey, connection.projectId]);

  const handleSignOut = useCallback(async () => {
    try {
      await authClient.signOut();
      await refetchSession();
      setConnection((current) => ({
        baseUrl: current.baseUrl || DEFAULT_CONNECTION.baseUrl,
        apiKey: '',
        projectId: '',
      }));
      setBackendProjects([]);
      setBackendDeployments([]);
      setLiveDeployments([]);
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
    isConnectionPending,
    authRequired,
    projectRows,
    deploymentRows,
    backendProjects,
    selectedProjectId: connection.projectId,
    deploymentIDsByProject,
    ensureFunctionURL,
    loadFunctionURLs,
    handleDeploy,
    handleGitHubDeploy,
    handleCreateProject,
    handleSignOut,
    refreshCatalog,
    saveConnection,
    selectProject,
    setIntegrationError,
    refetchSession,
  };
}
