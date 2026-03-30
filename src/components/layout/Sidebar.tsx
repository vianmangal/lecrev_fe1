import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  expanded: boolean;
  onToggleExpanded: () => void;
  screen: 'projects' | 'deployments' | 'settings' | 'detail' | 'deploy';
  onNavigate: (screen: 'projects' | 'deployments' | 'settings') => void;
}

export function Sidebar({ expanded, onToggleExpanded, screen, onNavigate }: SidebarProps) {
  return (
    <motion.aside
      animate={{ width: expanded ? 240 : 64 }}
      className="border-r border-border flex flex-col py-6 shrink-0 bg-surface/50 backdrop-blur-xl"
    >
      <div className={`px-4 mb-10 flex items-center ${expanded ? 'gap-3' : 'justify-center'}`}>
        <div className="text-white shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
          </svg>
        </div>
        <AnimatePresence>
          {expanded && (
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
          onClick={() => onNavigate('projects')}
          expanded={expanded}
          label="Projects"
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          )}
        />
        <SideItem
          active={screen === 'deployments'}
          onClick={() => onNavigate('deployments')}
          expanded={expanded}
          label="Deployments"
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          )}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 px-3">
        <SideItem
          active={screen === 'settings'}
          onClick={() => onNavigate('settings')}
          expanded={expanded}
          label="Settings"
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          )}
        />
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-muted hover:text-white"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={expanded ? 'rotate-90' : '-rotate-90'}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {expanded && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}

function SideItem({
  active,
  onClick,
  expanded,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  expanded: boolean;
  label: string;
  icon: React.ReactNode;
}) {
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
