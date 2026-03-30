import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, List, Settings, ChevronDown, Globe } from 'lucide-react';
import { ProjectsScreen, DeploymentsScreen } from './Screens';
import { DetailScreen } from './DetailScreen';
import { SettingsScreen } from './SettingsScreen';
import { DeployPage } from './DeployPage';
import { AuthScreen } from './AuthScreen';
import { CyanBtn } from './components/UI';
import { Deployment, LogEntry, Project } from './types';
import {
  ApiConnection,
  DeployRequestInput,
  DeploymentSummary,
  LiveDeploymentRecord,
  ProjectRecord,
  createFunctionVersion,
  getBuildJob,
  getBuildJobLogs,
  getDeploymentLogs,
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
} from './api';

type ScreenName = 'projects' | 'deployments' | 'settings' | 'detail' | 'deploy';

const CONNECTION_STORAGE_KEY = 'lecrev.ui.connection';
const DEFAULT_CONNECTION: ApiConnection = {
  baseUrl: (import.meta.env.VITE_LECREV_API_BASE_URL ?? '').trim(),
  apiKey: (import.meta.env.VITE_LECREV_API_KEY ?? '').trim(),
  projectId: (import.meta.env.VITE_LECREV_PROJECT_ID ?? '').trim(),
};

function loadConnection(): ApiConnection {
  try {
    const raw = window.localStorage.getItem(CONNECTION_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CONNECTION;
    }
    const parsed = JSON.parse(raw) as Partial<ApiConnection>;
    return {
      baseUrl: parsed.baseUrl ?? DEFAULT_CONNECTION.baseUrl,
      apiKey: parsed.apiKey ?? DEFAULT_CONNECTION.apiKey,
      projectId: parsed.projectId ?? DEFAULT_CONNECTION.projectId,
    };
  } catch {
    return DEFAULT_CONNECTION;
  }
}

function classifyLogLevel(line: string): LogEntry['level'] {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('failed')) {
    return 'ERROR';
  }
  if (lower.includes('warn')) {
    return 'WARN';
  }
  return 'INFO';
}

function toLogEntries(raw: string): LogEntry[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 200);

  if (lines.length === 0) {
    return [];
  }

  const now = Date.now();
  return lines.map((line, index) => ({
    t: new Date(now - (lines.length - index) * 1000).toLocaleTimeString('en-GB', { hour12: false }),
    level: classifyLogLevel(line),
    msg: line,
  }));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

function buildProjectURL(name: string): string {
  return `${slugify(name)}.lecrev.app`;
}

function buildProjectRow(projectID: string, projectName: string, deployments: Deployment[]): Project {
  const latest = deployments[0];
  const activeCount = deployments.filter((row) => row.status === 'Active').length;
  const readyCount = deployments.filter((row) => row.status === 'Ready').length;

  let instances = '0 Instances';
  if (activeCount > 0) {
    instances = `${activeCount} Instance${activeCount === 1 ? '' : 's'}`;
  } else if (readyCount > 0) {
    instances = `${readyCount} Warm`;
  } else if (latest) {
    instances = latest.status;
  }

  return {
    id: projectID,
    name: projectName,
    url: buildProjectURL(projectName || projectID),
    status: latest?.env ?? 'Production',
    instances,
    active: activeCount > 0 || readyCount > 0,
  };
}

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('projects');
  const [activeProj, setActiveProj] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('deployments');
  const [settingsTab, setSettingsTab] = useState('general');
  const [acctOpen, setAcctOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register' | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [connection, setConnection] = useState<ApiConnection>(() => loadConnection());
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [liveDeployments, setLiveDeployments] = useState<LiveDeploymentRecord[]>([]);
  const [backendProjects, setBackendProjects] = useState<ProjectRecord[]>([]);
  const [backendDeployments, setBackendDeployments] = useState<DeploymentSummary[]>([]);
  const [deploymentLogCache, setDeploymentLogCache] = useState<Record<string, string>>({});
  const [detailLogText, setDetailLogText] = useState<string | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection));
  }, [connection]);

  const refreshCatalog = useCallback(async (conn: ApiConnection) => {
    const [regionsResult, projectsResult, deploymentsResult] = await Promise.allSettled([
      listRegions(conn),
      listProjects(conn),
      listDeployments(conn, { limit: 50 }),
    ]);

    let nextError: string | null = null;

    if (regionsResult.status === 'fulfilled') {
      setAvailableRegions(regionsResult.value.map((row) => row.name));
    } else {
      setAvailableRegions([]);
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

  useEffect(() => {
    if (!activeProj) {
      return;
    }
    const next = projectRows.find((project) => project.id === activeProj.id);
    if (!next) {
      setActiveProj(null);
      return;
    }
    if (
      next.name !== activeProj.name ||
      next.url !== activeProj.url ||
      next.status !== activeProj.status ||
      next.instances !== activeProj.instances ||
      next.active !== activeProj.active
    ) {
      setActiveProj(next);
    }
  }, [activeProj, projectRows]);

  const detailDeployments = useMemo<Deployment[]>(() => {
    if (!activeProj) {
      return deploymentRows.slice(0, 4);
    }
    const targetIDs = new Set(deploymentIDsByProject.get(activeProj.id) ?? []);
    const rows = deploymentRows.filter((row) => targetIDs.has(row.id));
    return rows.length > 0 ? rows : deploymentRows.slice(0, 4);
  }, [activeProj, deploymentIDsByProject, deploymentRows]);

  const activeDetailDeploymentID = detailDeployments[0]?.id;

  useEffect(() => {
    if (activeTab !== 'logs' || !activeDetailDeploymentID) {
      setDetailLogText(null);
      return;
    }

    const liveRecord = liveDeployments.find((record) => record.version.id === activeDetailDeploymentID);
    const fallbackRaw = liveRecord?.jobLogs || liveRecord?.buildLogs || liveRecord?.error || null;
    const cached = deploymentLogCache[activeDetailDeploymentID];

    if (cached) {
      setDetailLogText(cached);
      return;
    }

    setDetailLogText(fallbackRaw);

    let cancelled = false;
    void getDeploymentLogs(connection, activeDetailDeploymentID)
      .then((raw) => {
        if (cancelled) {
          return;
        }
        setDeploymentLogCache((prev) => ({
          ...prev,
          [activeDetailDeploymentID]: raw,
        }));
        setDetailLogText(raw);
      })
      .catch(() => {
        if (!cancelled && !fallbackRaw) {
          setDetailLogText(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetailDeploymentID, activeTab, connection, deploymentLogCache, liveDeployments]);

  const detailLogs = useMemo<LogEntry[] | undefined>(() => {
    if (!detailLogText) {
      return undefined;
    }
    const parsed = toLogEntries(detailLogText);
    return parsed.length > 0 ? parsed : undefined;
  }, [detailLogText]);

  const saveConnection = useCallback((next: ApiConnection) => {
    setConnection(next);
    setIntegrationError(null);
  }, []);

  const go = (nextScreen: ScreenName) => {
    setScreen(nextScreen);
    setAcctOpen(false);
  };

  return (
    <div className="flex h-screen bg-bg text-white overflow-hidden font-sans">
      <AnimatePresence>
        {authMode && (
          <AuthScreen
            initialMode={authMode}
            onSuccess={() => setAuthMode(null)}
            onBack={() => setAuthMode(null)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: sidebarExpanded ? 240 : 64 }}
        className="border-r border-border hidden md:flex flex-col py-6 shrink-0 bg-surface/50 backdrop-blur-xl"
      >
        <div className={`px-4 mb-10 flex items-center ${sidebarExpanded ? 'gap-3' : 'justify-center'}`}>
          <div className="text-white shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
            </svg>
          </div>
          <AnimatePresence>
            {sidebarExpanded && (
              <motion.span
                key="logo-text"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-black text-lg tracking-tighter whitespace-nowrap"
              >
                LECREV
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 flex flex-col gap-2 px-3">
          <SideItem
            active={screen === 'projects' || screen === 'detail'}
            onClick={() => go('projects')}
            expanded={sidebarExpanded}
            label="Projects"
            icon={<LayoutGrid size={20} strokeWidth={1.5} />}
          />
          <SideItem
            active={screen === 'deployments'}
            onClick={() => go('deployments')}
            expanded={sidebarExpanded}
            label="Deployments"
            icon={<List size={20} strokeWidth={1.5} />}
          />
        </div>

        <div className="mt-auto flex flex-col gap-2 px-3">
          <SideItem
            active={screen === 'settings'}
            onClick={() => go('settings')}
            expanded={sidebarExpanded}
            label="Settings"
            icon={<Settings size={20} strokeWidth={1.5} />}
          />
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-muted hover:text-white"
          >
            <ChevronDown size={20} className={sidebarExpanded ? 'rotate-90' : '-rotate-90'} />
            {sidebarExpanded && <span className="text-sm font-medium">Collapse</span>}
          </button>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <AnimatePresence mode="wait">
              {screen === 'detail' && activeProj && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-sub text-sm"
                >
                  <button
                    onClick={() => go('projects')}
                    className="text-sub hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0 text-lg leading-none"
                    aria-label="Back to Projects"
                  >
                    ←
                  </button>
                  <span className="opacity-50">Projects</span>
                  <span className="opacity-30">/</span>
                  <span className="text-white font-medium">{activeProj.name}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex border border-border rounded-md overflow-hidden">
              <SplitAuthBtn onClick={() => setAuthMode('signin')}>Sign In</SplitAuthBtn>
              <div className="w-[1px] bg-border" />
              <SplitAuthBtn onClick={() => setAuthMode('register')}>Register</SplitAuthBtn>
            </div>

            <div className="hidden sm:block w-[1px] h-5 bg-border" />

            <div className="hidden sm:block relative">
              <button
                onClick={() => setAcctOpen(!acctOpen)}
                className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] transition-colors duration-150 bg-transparent border-none px-1 py-1.5 cursor-pointer ${acctOpen ? 'text-white' : 'text-sub'}`}
              >
                Account
                <motion.span
                  animate={{ rotate: acctOpen ? 180 : 0 }}
                  className="text-[7px] opacity-50"
                >
                  ▼
                </motion.span>
              </button>
              <AnimatePresence>
                {acctOpen && (
                  <AccountDropdown onClose={() => setAcctOpen(false)} onNavigate={go} />
                )}
              </AnimatePresence>
            </div>

            <CyanBtn onClick={() => go('deploy')}>Deploy</CyanBtn>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="wait">
            {screen === 'projects' && (
              <ProjectsScreen
                key="projects"
                onViewProject={(project) => { setActiveProj(project); go('detail'); }}
                projects={projectRows}
              />
            )}
            {screen === 'deployments' && <DeploymentsScreen key="deployments" deployments={deploymentRows} />}
            {screen === 'detail' && (
              <DetailScreen
                key="detail"
                project={activeProj}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                deployments={detailDeployments}
                logs={detailLogs}
              />
            )}
            {screen === 'settings' && (
              <SettingsScreen
                key="settings"
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
                connection={connection}
                onSaveConnection={saveConnection}
                availableRegions={availableRegions}
              />
            )}
            {screen === 'deploy' && (
              <DeployPage
                key="deploy"
                onBack={() => go('deployments')}
                onDeploy={handleDeploy}
                defaultProjectId={connection.projectId}
                regionOptions={availableRegions}
              />
            )}
          </AnimatePresence>
        </main>

        <footer className="hidden md:flex h-8 border-t border-border px-4 items-center justify-between shrink-0">
          <div className="flex items-center gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${integrationError ? 'bg-amber-500' : 'bg-cyan-primary'}`} />
              LECREV_SYSTEM_CORE
            </div>
            {availableRegions[0] && <span className="flex items-center gap-1"><Globe size={10} /> {availableRegions[0]}</span>}
          </div>
          <div className="flex gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
            <span>{integrationError ? 'API: Degraded' : 'API: Connected'}</span>
            <span>{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
          </div>
        </footer>

        <nav className="md:hidden flex items-center justify-around border-t border-border bg-surface/95 backdrop-blur-xl h-14 shrink-0">
          <button
            onClick={() => go('projects')}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${screen === 'projects' || screen === 'detail' ? 'text-cyan-primary' : 'text-muted hover:text-white'}`}
          >
            <LayoutGrid size={18} strokeWidth={1.5} />
            <span className="text-[8px] uppercase tracking-[0.1em]">Projects</span>
          </button>
          <button
            onClick={() => go('deployments')}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${screen === 'deployments' ? 'text-cyan-primary' : 'text-muted hover:text-white'}`}
          >
            <List size={18} strokeWidth={1.5} />
            <span className="text-[8px] uppercase tracking-[0.1em]">Deploys</span>
          </button>
          <button
            onClick={() => go('deploy')}
            className="bg-cyan-primary text-black px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em]"
          >
            Deploy
          </button>
          <button
            onClick={() => go('settings')}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${screen === 'settings' ? 'text-cyan-primary' : 'text-muted hover:text-white'}`}
          >
            <Settings size={18} strokeWidth={1.5} />
            <span className="text-[8px] uppercase tracking-[0.1em]">Settings</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function SideItem({ active, onClick, expanded, label, icon }: { active: boolean; onClick: () => void; expanded: boolean; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 rounded-lg transition-all duration-150 cursor-pointer
        ${active ? 'bg-cyan-primary/10 text-cyan-primary' : 'text-muted hover:bg-white/5 hover:text-white'}
      `}
    >
      <div className="shrink-0">{icon}</div>
      {expanded && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm font-medium"
        >
          {label}
        </motion.span>
      )}
    </button>
  );
}

function SplitAuthBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] uppercase tracking-[0.12em] px-4 py-1.5 cursor-pointer transition-all duration-150 bg-transparent border-none text-sub hover:bg-surface hover:text-white"
    >
      {children}
    </button>
  );
}

function AccountDropdown({ onClose, onNavigate }: { onClose: () => void; onNavigate: (screen: ScreenName) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { label: 'Profile', icon: '◉', action: onClose },
    { label: 'Team', icon: '◎', action: () => { onNavigate('settings'); onClose(); } },
    { label: 'API Keys', icon: '◇', action: () => { onNavigate('settings'); onClose(); } },
    { label: 'Settings', icon: '◆', action: () => { onNavigate('settings'); onClose(); } },
    { divider: true },
    { label: 'Sign Out', icon: '→', action: onClose, danger: true },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-[calc(100%+8px)] right-0 bg-elevated border border-border-md w-[220px] z-[100] shadow-[0_16px_48px_rgba(0,0,0,0.8)]"
    >
      <div className="p-4 border-b border-border">
        <p className="text-[12px] mb-1">Account</p>
      </div>
      <div className="py-1">
        {items.map((item, index) => {
          if ('divider' in item) {
            return <div key={index} className="h-[1px] bg-border my-1" />;
          }
          return (
            <button
              key={item.label}
              onClick={item.action}
              className={`
                flex items-center gap-2.5 w-full px-5 py-2.5 bg-transparent border-none cursor-pointer text-left transition-colors duration-120 text-[11px] uppercase tracking-[0.1em]
                ${item.danger ? 'text-red-500/60 hover:bg-surface hover:text-red-500' : 'text-sub hover:bg-surface hover:text-white'}
              `}
            >
              <span className="text-[10px] opacity-60">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
