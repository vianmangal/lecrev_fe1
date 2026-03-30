import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, List, Settings, ChevronDown, Globe, Zap, Cpu } from 'lucide-react';
import { ProjectsScreen, DeploymentsScreen } from './Screens';
import { DetailScreen } from './DetailScreen';
import { SettingsScreen } from './SettingsScreen';
import { DeployPage } from './DeployPage';
import { AuthScreen } from './AuthScreen';
import { CyanBtn } from './components/UI';
import { Project } from './types';

export default function App() {
  const [screen, setScreen] = useState<"projects" | "deployments" | "settings" | "detail" | "deploy">("projects");
  const [activeProj, setActiveProj] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("deployments");
  const [settingsTab, setSettingsTab] = useState("general");
  const [acctOpen, setAcctOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register' | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

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
              />
            )}
            {screen === "deployments" && <DeploymentsScreen key="deployments" />}
            {screen === "detail" && (
              <DetailScreen
                key="detail"
                project={activeProj}
                onBack={() => go("projects")}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            )}
            {screen === "settings" && (
              <SettingsScreen
                key="settings"
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
              />
            )}
            {screen === "deploy" && (
              <DeployPage
                key="deploy"
                onBack={() => go("deployments")}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="h-8 border-t border-border px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary" />
              LECREV_SYSTEM_CORE
            </div>
            <span className="flex items-center gap-1"><Globe size={10} /> LHR-01</span>
            <span className="flex items-center gap-1"><Zap size={10} /> 200ms</span>
          </div>
          <div className="flex gap-6 text-[9px] uppercase tracking-[0.15em] text-muted">
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
