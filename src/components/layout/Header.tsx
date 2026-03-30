import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CyanBtn } from '../UI';
import { AccountDropdown } from './AccountDropdown';
import { Project } from '../../types';

interface HeaderProps {
  screen: 'projects' | 'deployments' | 'settings' | 'detail' | 'deploy';
  activeProject: Project | null;
  activeUser: { email?: string; name?: string | null } | null;
  isSessionPending: boolean;
  authRequired: boolean;
  accountOpen: boolean;
  onSetAuthMode: (mode: 'signin' | 'register' | null) => void;
  onToggleAccount: () => void;
  onCloseAccount: () => void;
  onNavigateProjects: () => void;
  onNavigateSettings: () => void;
  onNavigateDeploy: () => void;
  onSignOut: () => Promise<void>;
}

export function Header({
  screen,
  activeProject,
  activeUser,
  isSessionPending,
  authRequired,
  accountOpen,
  onSetAuthMode,
  onToggleAccount,
  onCloseAccount,
  onNavigateProjects,
  onNavigateSettings,
  onNavigateDeploy,
  onSignOut,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center gap-4">
        <AnimatePresence mode="wait">
          {screen === 'detail' && activeProject && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-sub text-sm"
            >
              <button
                onClick={onNavigateProjects}
                className="text-sub hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0 text-lg leading-none"
                aria-label="Back to Projects"
              >
                ←
              </button>
              <span className="opacity-50">Projects</span>
              <span className="opacity-30">/</span>
              <span className="text-white font-medium">{activeProject.name}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4">
        {!activeUser && !isSessionPending && (
          <div className="flex border border-border rounded-md overflow-hidden">
            <SplitAuthBtn onClick={() => onSetAuthMode('signin')}>Sign In</SplitAuthBtn>
            <div className="w-[1px] bg-border" />
            <SplitAuthBtn onClick={() => onSetAuthMode('register')}>Register</SplitAuthBtn>
          </div>
        )}

        {activeUser && (
          <>
            <div className="h-5 w-[1px] bg-border" />

            <div className="relative">
              <button
                onClick={onToggleAccount}
                className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] transition-colors duration-150 bg-transparent border-none px-1 py-1.5 cursor-pointer ${accountOpen ? 'text-white' : 'text-sub'}`}
              >
                {activeUser.name || 'Account'}
                <motion.span
                  animate={{ rotate: accountOpen ? 180 : 0 }}
                  className="text-[7px] opacity-50"
                >
                  ▼
                </motion.span>
              </button>
              <AnimatePresence>
                {accountOpen && (
                  <AccountDropdown
                    onClose={onCloseAccount}
                    onNavigateToSettings={onNavigateSettings}
                    onSignOut={onSignOut}
                    userEmail={activeUser.email || 'github-user'}
                    userName={activeUser.name || 'GitHub User'}
                  />
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        <CyanBtn onClick={onNavigateDeploy} disabled={authRequired}>
          Deploy
        </CyanBtn>
      </div>
    </header>
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
