import React, { useEffect, useState } from 'react';
import { ChevronDown, Globe, LayoutGrid, List, Settings } from 'lucide-react';
import { AuthScreen } from './AuthScreen';
import { DeploymentsScreen, ProjectsScreen } from './Screens';
import { Deployment, Project } from './types';

const HERO_TEXT = 'Lecrev is the best way to implement.';

const DEMO_PROJECTS: Project[] = [
  {
    id: 'demo',
    name: 'demo',
    url: 'demo.lecrev.app',
    status: 'Production',
    instances: '7 Instances',
    active: true,
  },
];

const DEMO_DEPLOYMENTS: Deployment[] = [
  {
    id: '8454090e-8da9-4f9a-bed2',
    project: 'demo',
    branch: 'main',
    commit: 'a1b2c3d',
    env: 'Production',
    status: 'Active',
    age: '22m',
    region: 'ap-south-1',
  },
];

type AppView = 'landing' | 'dashboard';
type DashboardScreen = 'projects' | 'deployments' | 'settings';

export default function App() {
  const [typedText, setTypedText] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [view, setView] = useState<AppView>('landing');

  useEffect(() => {
    let index = 0;
    let timeoutId = 0;

    const typeNext = () => {
      if (index <= HERO_TEXT.length) {
        setTypedText(HERO_TEXT.slice(0, index));
        index += 1;
        const delay = 50 + Math.floor(Math.random() * 31);
        timeoutId = window.setTimeout(typeNext, delay);
      }
    };

    typeNext();

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const openAuth = (mode: 'signin' | 'register') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const authOverlay = authOpen ? (
    <AuthScreen
      initialMode={authMode}
      onSuccess={() => {
        setAuthOpen(false);
        setView('dashboard');
      }}
      onBack={() => setAuthOpen(false)}
    />
  ) : null;

  if (view === 'dashboard') {
    return (
      <>
        {authOverlay}
        <DashboardView
          onSignIn={() => openAuth('signin')}
          onRegister={() => openAuth('register')}
          onSignOut={() => setView('landing')}
        />
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-bg text-white font-sans">
      {authOverlay}

      <button
        onClick={() => openAuth('signin')}
        className="fixed right-4 top-4 z-[90] rounded-full border border-border bg-surface/85 px-4 py-2 text-[10px] uppercase tracking-[0.13em] text-sub shadow-[0_10px_30px_rgba(0,0,0,0.38)] backdrop-blur transition-colors duration-150 hover:border-white hover:text-white sm:right-6 sm:top-5 lg:right-8"
      >
        Sign in
      </button>

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(84,218,241,0.12),transparent_45%)]" />
        <div className="pointer-events-none absolute left-4 top-5 z-10 flex items-center gap-2.5 text-white sm:left-6 lg:left-8" aria-hidden="true">
          <span className="shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
            </svg>
          </span>
          <span className="font-black text-base tracking-tighter whitespace-nowrap uppercase">LECREV</span>
        </div>
        <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6 sm:pb-28 sm:pt-28 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mx-auto min-h-[5.75rem] max-w-4xl text-balance text-2xl font-medium leading-tight tracking-[-0.02em] text-white sm:min-h-[6.75rem] sm:text-4xl md:min-h-[8rem] md:text-5xl">
              {typedText}
              <span className="type-cursor" aria-hidden="true">|</span>
            </h1>

            <div className="mx-auto mt-8 w-full max-w-5xl sm:mt-12">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-md bg-surface shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.08),transparent_55%)]" />
                <div className="absolute left-4 top-4 flex gap-2 opacity-70">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={() => openAuth('signin')}
                    aria-label="Play demo"
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/60 transition-colors duration-150 hover:bg-black/80"
                  >
                    <span className="ml-1 block h-0 w-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-white/90" />
                  </button>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function DashboardView({
  onSignIn,
  onRegister,
  onSignOut,
}: {
  onSignIn: () => void;
  onRegister: () => void;
  onSignOut: () => void;
}) {
  const [screen, setScreen] = useState<DashboardScreen>('projects');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-bg text-white overflow-hidden font-sans">
      <aside className={`border-r border-border hidden md:flex flex-col py-6 shrink-0 bg-surface/50 backdrop-blur-xl ${sidebarExpanded ? 'w-[248px]' : 'w-16'}`}>
        <button
          onClick={() => setScreen('projects')}
          className={`px-4 mb-10 flex items-center ${sidebarExpanded ? 'gap-3' : 'justify-center'} bg-transparent border-none text-left cursor-pointer text-white`}
        >
          <div className="text-white shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
            </svg>
          </div>
          {sidebarExpanded && <span className="font-black text-3xl tracking-tighter whitespace-nowrap">LECREV</span>}
        </button>

        <div className="flex-1 flex flex-col gap-2 px-3">
          <SideItem
            active={screen === 'projects'}
            onClick={() => setScreen('projects')}
            expanded={sidebarExpanded}
            label="Projects"
            icon={<LayoutGrid size={20} strokeWidth={1.5} />}
          />
          <SideItem
            active={screen === 'deployments'}
            onClick={() => setScreen('deployments')}
            expanded={sidebarExpanded}
            label="Deployments"
            icon={<List size={20} strokeWidth={1.5} />}
          />
        </div>

        <div className="mt-auto flex flex-col gap-2 px-3">
          <SideItem
            active={screen === 'settings'}
            onClick={() => setScreen('settings')}
            expanded={sidebarExpanded}
            label="Settings"
            icon={<Settings size={20} strokeWidth={1.5} />}
          />
          <button
            onClick={() => setSidebarExpanded((prev) => !prev)}
            className={`w-full flex items-center p-3 rounded-lg hover:bg-white/5 transition-colors text-muted hover:text-white bg-transparent border-none cursor-pointer ${sidebarExpanded ? 'gap-3 justify-start' : 'justify-center'}`}
          >
            <ChevronDown size={20} className={sidebarExpanded ? 'rotate-90' : '-rotate-90'} />
            {sidebarExpanded && <span className="text-sm font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border flex items-center justify-end px-4 sm:px-6 md:px-8 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex border border-border rounded-md overflow-hidden">
              <SplitAuthBtn onClick={onSignIn}>Sign In</SplitAuthBtn>
              <div className="w-[1px] bg-border" />
              <SplitAuthBtn onClick={onRegister}>Register</SplitAuthBtn>
            </div>

            <div className="hidden sm:block w-[1px] h-5 bg-border" />

            <div className="hidden sm:block relative">
              <button
                onClick={() => setAccountOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] bg-transparent border-none text-sub hover:text-white transition-colors duration-150 cursor-pointer"
              >
                Account
                <span className="text-[7px] opacity-50">▼</span>
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[168px] border border-border bg-elevated shadow-[0_16px_42px_rgba(0,0,0,0.78)] z-20">
                  <button
                    onClick={() => {
                      setScreen('settings');
                      setAccountOpen(false);
                    }}
                    className="w-full text-left bg-transparent border-none px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] text-sub hover:text-white hover:bg-surface transition-colors duration-150 cursor-pointer"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setScreen('settings');
                      setAccountOpen(false);
                    }}
                    className="w-full text-left bg-transparent border-none px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] text-sub hover:text-white hover:bg-surface transition-colors duration-150 cursor-pointer"
                  >
                    Settings
                  </button>
                  <div className="h-[1px] bg-border" />
                  <button
                    onClick={() => {
                      setAccountOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left bg-transparent border-none px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] text-red-500/70 hover:text-red-500 hover:bg-surface transition-colors duration-150 cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setScreen('deployments');
                setAccountOpen(false);
              }}
              className="bg-cyan-primary text-black px-6 py-2 text-[10px] font-bold uppercase tracking-[0.15em] border-none cursor-pointer transition-colors duration-150 hover:bg-cyan-hover"
            >
              Deploy
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
          {screen === 'projects' && (
            <ProjectsScreen
              projects={DEMO_PROJECTS}
              onViewProject={() => {
                setScreen('deployments');
                setAccountOpen(false);
              }}
            />
          )}
          {screen === 'deployments' && (
            <DeploymentsScreen deployments={DEMO_DEPLOYMENTS} />
          )}
          {screen === 'settings' && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-xl border border-border p-6 text-center bg-surface/40">
                <p className="text-[11px] uppercase tracking-[0.15em] text-sub">Settings</p>
                <p className="text-[12px] text-muted mt-2">Dashboard settings panel placeholder.</p>
              </div>
            </div>
          )}
        </main>

        <footer className="hidden md:flex h-8 border-t border-border px-4 items-center justify-between shrink-0">
          <div className="flex items-center gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary" />
              LECREV_SYSTEM_CORE
            </div>
            <span className="flex items-center gap-1"><Globe size={10} /> AP-SOUTH-1</span>
          </div>
          <div className="flex gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
            <span>API: Connected</span>
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
        w-full flex items-center p-3 rounded-lg transition-all duration-150 cursor-pointer bg-transparent border-none
        ${expanded ? 'gap-3 justify-start' : 'justify-center'}
        ${active ? 'bg-cyan-primary/10 text-cyan-primary' : 'text-muted hover:bg-white/5 hover:text-white'}
      `}
    >
      <div className="shrink-0">{icon}</div>
      {expanded && <span className="text-sm font-medium">{label}</span>}
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
