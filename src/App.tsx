import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, List, Settings, ChevronDown, Globe, Zap, Cpu } from 'lucide-react';
import { ProjectsScreen, DeploymentsScreen } from './Screens';
import { DetailScreen } from './DetailScreen';
import { SettingsScreen } from './SettingsScreen';
import { DeployPage } from './DeployPage';
import { AuthScreen } from './AuthScreen';
import { CyanBtn } from './components/UI';
import { Deployment, LogEntry, Project } from './types';
import { DEPLOYS, PROJECTS } from './constants';
import {
  ApiConnection,
  DeployRequestInput,
  LiveDeploymentRecord,
  createFunctionVersion,
  getBuildJob,
  getBuildJobLogs,
  getFunctionVersion,
  getJob,
  getJobLogs,
  getJobOutput,
  invokeFunction,
  listRegions,
  sleep,
  toDeploymentRow,
} from './api';

const CONNECTION_STORAGE_KEY = 'lecrev.ui.connection';
const FALLBACK_REGIONS = ['ap-south-1', 'ap-south-2', 'ap-southeast-1'];
const DEFAULT_CONNECTION: ApiConnection = {
  baseUrl: '',
  apiKey: 'dev-root-key',
  projectId: 'demo',
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

export default function App() {
  const [screen, setScreen] = useState<"projects" | "deployments" | "settings" | "detail" | "deploy">("projects");
  const [activeProj, setActiveProj] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("deployments");
  const [settingsTab, setSettingsTab] = useState("general");
  const [acctOpen, setAcctOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register' | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [connection, setConnection] = useState<ApiConnection>(() => loadConnection());
  const [availableRegions, setAvailableRegions] = useState<string[]>(FALLBACK_REGIONS);
  const [liveDeployments, setLiveDeployments] = useState<LiveDeploymentRecord[]>([]);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection));
  }, [connection]);

  useEffect(() => {
    let cancelled = false;
    const refreshRegions = async () => {
      try {
        const rows = await listRegions(connection);
        if (cancelled) {
          return;
        }
        if (rows.length > 0) {
          setAvailableRegions(rows.map((row) => row.name));
        } else {
          setAvailableRegions(FALLBACK_REGIONS);
        }
        setIntegrationError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setAvailableRegions(FALLBACK_REGIONS);
        setIntegrationError(err instanceof Error ? err.message : 'Unable to load region catalog.');
      }
    };

    void refreshRegions();
    return () => {
      cancelled = true;
    };
  }, [connection.baseUrl, connection.apiKey]);

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
    }
  }, [patchLiveDeployment]);

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
        error: err instanceof Error ? err.message : 'Build polling failed.',
      }));
    }
  }, [patchLiveDeployment, trackExecutionLifecycle]);

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

      if (version.buildJobId) {
        void trackBuildLifecycle(conn, version.id, version.buildJobId);
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
  }, [connection, trackBuildLifecycle]);

  const deploymentRows = useMemo<Deployment[]>(() => {
    const map = new Map<string, Deployment>();
    for (const row of liveDeployments.map(toDeploymentRow)) {
      map.set(row.id, row);
    }
    for (const row of DEPLOYS) {
      if (!map.has(row.id)) {
        map.set(row.id, row);
      }
    }
    return Array.from(map.values());
  }, [liveDeployments]);

  const projectRows = useMemo<Project[]>(() => {
    const map = new Map<string, Project>();
    for (const project of PROJECTS) {
      map.set(project.name, project);
    }
    for (const row of liveDeployments.map(toDeploymentRow)) {
      const slug = row.project
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const active = row.status === 'Active' || row.status === 'Ready';
      map.set(row.project, {
        name: row.project,
        url: `${slug || 'project'}.lecrev.app`,
        status: row.env,
        instances: active ? '1 Instance' : row.status,
        active,
      });
    }
    return Array.from(map.values());
  }, [liveDeployments]);

  const detailDeployments = useMemo<Deployment[]>(() => {
    if (!activeProj) {
      return deploymentRows.slice(0, 4);
    }
    const rows = deploymentRows.filter((row) => row.project === activeProj.name);
    return rows.length > 0 ? rows : deploymentRows.slice(0, 4);
  }, [activeProj, deploymentRows]);

  const detailLogs = useMemo<LogEntry[] | undefined>(() => {
    if (!activeProj) {
      return undefined;
    }
    const record = liveDeployments.find((entry) => entry.projectId === activeProj.name);
    if (!record) {
      return undefined;
    }
    const raw = record.jobLogs || record.buildLogs || record.error;
    if (!raw) {
      return undefined;
    }
    const parsed = toLogEntries(raw);
    return parsed.length > 0 ? parsed : undefined;
  }, [activeProj, liveDeployments]);

  const saveConnection = useCallback((next: ApiConnection) => {
    setConnection(next);
    setIntegrationError(null);
  }, []);

  const go = (s: typeof screen) => {
    setScreen(s);
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

      {/* Sidebar */}
      <motion.aside 
        animate={{ width: sidebarExpanded ? 240 : 64 }}
        className="border-r border-border flex flex-col py-6 shrink-0 bg-surface/50 backdrop-blur-xl"
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
            active={screen === "projects" || screen === "detail"} 
            onClick={() => go("projects")}
            expanded={sidebarExpanded}
            label="Projects"
            icon={<LayoutGrid size={20} strokeWidth={1.5} />}
          />
          <SideItem 
            active={screen === "deployments"} 
            onClick={() => go("deployments")}
            expanded={sidebarExpanded}
            label="Deployments"
            icon={<List size={20} strokeWidth={1.5} />}
          />
        </div>

        <div className="mt-auto flex flex-col gap-2 px-3">
          <SideItem 
            active={screen === "settings"} 
            onClick={() => go("settings")}
            expanded={sidebarExpanded}
            label="Settings"
            icon={<Settings size={20} strokeWidth={1.5} />}
          />
          <button 
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-muted hover:text-white"
          >
            <ChevronDown size={20} className={sidebarExpanded ? "rotate-90" : "-rotate-90"} />
            {sidebarExpanded && <span className="text-sm font-medium">Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <AnimatePresence mode="wait">
              {screen === "detail" && activeProj && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-sub text-sm"
                >
                  <span className="opacity-50">Projects</span>
                  <span className="opacity-30">/</span>
                  <span className="text-white font-medium">{activeProj.name}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex border border-border rounded-md overflow-hidden">
              <SplitAuthBtn onClick={() => setAuthMode('signin')}>Sign In</SplitAuthBtn>
              <div className="w-[1px] bg-border" />
              <SplitAuthBtn onClick={() => setAuthMode('register')}>Register</SplitAuthBtn>
            </div>

            <div className="w-[1px] h-5 bg-border" />

            <div className="relative">
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

            <CyanBtn onClick={() => go("deploy")}>Deploy</CyanBtn>
          </div>
        </header>

        {/* Screen Area */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="wait">
            {screen === "projects" && (
              <ProjectsScreen
                key="projects"
                onViewProject={p => { setActiveProj(p); go("detail"); }}
                projects={projectRows}
              />
            )}
            {screen === "deployments" && <DeploymentsScreen key="deployments" deployments={deploymentRows} />}
            {screen === "detail" && (
              <DetailScreen
                key="detail"
                project={activeProj}
                onBack={() => go("projects")}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                deployments={detailDeployments}
                logs={detailLogs}
              />
            )}
            {screen === "settings" && (
              <SettingsScreen
                key="settings"
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
                connection={connection}
                onSaveConnection={saveConnection}
                availableRegions={availableRegions}
              />
            )}
            {screen === "deploy" && (
              <DeployPage
                key="deploy"
                onBack={() => go("deployments")}
                onDeploy={handleDeploy}
                defaultProjectId={connection.projectId}
                regionOptions={availableRegions}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="h-8 border-t border-border px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${integrationError ? 'bg-amber-500' : 'bg-cyan-primary'}`} />
              LECREV_SYSTEM_CORE
            </div>
            <span className="flex items-center gap-1"><Globe size={10} /> {availableRegions[0] || 'ap-south-1'}</span>
            <span className="flex items-center gap-1"><Zap size={10} /> 200ms</span>
          </div>
          <div className="flex gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
            <span>{integrationError ? 'API: Degraded' : 'API: Connected'}</span>
            <span className="flex items-center gap-1"><Cpu size={10} /> 8%</span>
            <span>{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
          </div>
        </footer>
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

function NavTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] uppercase tracking-[0.12em] bg-transparent border-none pb-1 cursor-pointer transition-colors duration-150 relative ${active ? 'text-white' : 'text-sub hover:text-white'}`}
    >
      {children}
      {active && (
        <motion.div
          layoutId="headerNavTab"
          className="absolute bottom-0 left-0 right-0 h-[1px] bg-cyan-primary"
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
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

function AccountDropdown({ onClose, onNavigate }: { onClose: () => void; onNavigate: (s: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { label: "Profile", icon: "◉", action: onClose },
    { label: "Team", icon: "◎", action: () => { onNavigate("settings"); onClose(); } },
    { label: "API Keys", icon: "◇", action: () => { onNavigate("settings"); onClose(); } },
    { label: "Settings", icon: "◆", action: () => { onNavigate("settings"); onClose(); } },
    { divider: true },
    { label: "Sign Out", icon: "→", action: onClose, danger: true },
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
        <p className="text-[12px] mb-1">alex.chen</p>
        <p className="text-[10px] text-sub">alex@lecrev.sh</p>
      </div>
      <div className="py-1">
        {items.map((item, i) => {
          if ('divider' in item) return <div key={i} className="h-[1px] bg-border my-1" />;
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
