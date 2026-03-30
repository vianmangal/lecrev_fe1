import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ProjectsScreen, DeploymentsScreen } from './Screens';
import { DetailScreen } from './DetailScreen';
import { SettingsScreen } from './SettingsScreen';
import { DeployPage } from './DeployPage';
import { AuthScreen } from './AuthScreen';
import { Project } from './types';
import { useDashboardData } from './hooks/useDashboardData';
import { useDetailLogs } from './hooks/useDetailLogs';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';

type ScreenName = 'projects' | 'deployments' | 'settings' | 'detail' | 'deploy';

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('projects');
  const [activeProj, setActiveProj] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('deployments');
  const [settingsTab, setSettingsTab] = useState('general');
  const [acctOpen, setAcctOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register' | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const {
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
    saveConnection,
    refetchSession,
  } = useDashboardData();

  useEffect(() => {
    if (activeUser) {
      setAuthMode(null);
    }
  }, [activeUser]);

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

  const detailDeployments = useMemo(() => {
    if (!activeProj) {
      return deploymentRows.slice(0, 4);
    }
    const targetIDs = new Set(deploymentIDsByProject.get(activeProj.id) ?? []);
    const rows = deploymentRows.filter((row) => targetIDs.has(row.id));
    return rows.length > 0 ? rows : deploymentRows.slice(0, 4);
  }, [activeProj, deploymentIDsByProject, deploymentRows]);

  const activeDetailDeploymentID = detailDeployments[0]?.id;
  const detailLogs = useDetailLogs(connection, activeTab, activeDetailDeploymentID, liveDeployments);

  const go = (nextScreen: ScreenName) => {
    setScreen(nextScreen);
    setAcctOpen(false);
  };

  return (
    <div className="flex h-screen bg-bg text-white overflow-hidden font-sans">
      <AnimatePresence>
        {(authRequired || authMode) && (
          <AuthScreen
            initialMode={authMode ?? 'signin'}
            required={authRequired}
            githubConfigured={githubConfigured === true}
            onSuccess={() => {
              void refetchSession();
              setAuthMode(null);
            }}
            onBack={() => {
              if (!authRequired) {
                setAuthMode(null);
              }
            }}
          />
        )}
      </AnimatePresence>

      <Sidebar
        expanded={sidebarExpanded}
        onToggleExpanded={() => setSidebarExpanded((current) => !current)}
        screen={screen}
        onNavigate={(nextScreen) => go(nextScreen)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          screen={screen}
          activeProject={activeProj}
          activeUser={activeUser}
          isSessionPending={isSessionPending}
          authRequired={authRequired}
          accountOpen={acctOpen}
          onSetAuthMode={setAuthMode}
          onToggleAccount={() => setAcctOpen((current) => !current)}
          onCloseAccount={() => setAcctOpen(false)}
          onNavigateProjects={() => go('projects')}
          onNavigateSettings={() => go('settings')}
          onNavigateDeploy={() => go('deploy')}
          onSignOut={handleSignOut}
        />

        <main className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="wait">
            {screen === 'projects' && (
              <ProjectsScreen
                key="projects"
                onViewProject={(project) => {
                  setActiveProj(project);
                  go('detail');
                }}
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

        <Footer
          integrationError={integrationError}
          githubConfigured={githubConfigured}
          availableRegions={availableRegions}
        />
      </div>
    </div>
  );
}
