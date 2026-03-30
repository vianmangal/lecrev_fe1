import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface AccountDropdownProps {
  onClose: () => void;
  onNavigateToSettings: () => void;
  onSignOut: () => Promise<void>;
  userEmail: string;
  userName: string;
}

export function AccountDropdown({
  onClose,
  onNavigateToSettings,
  onSignOut,
  userEmail,
  userName,
}: AccountDropdownProps) {
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
    { label: 'Settings', icon: '◆', action: () => { onNavigateToSettings(); onClose(); } },
    { divider: true },
    {
      label: 'Sign Out',
      icon: '→',
      action: () => {
        onClose();
        void onSignOut();
      },
      danger: true,
    },
  ] as const;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-[calc(100%+8px)] right-0 bg-elevated border border-border-md w-[220px] z-[100] shadow-[0_16px_48px_rgba(0,0,0,0.8)]"
    >
      <div className="p-4 border-b border-border">
        <p className="text-[12px] mb-1">{userName}</p>
        <p className="text-[10px] text-sub">{userEmail}</p>
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
                ${'danger' in item && item.danger === true ? 'text-red-500/60 hover:bg-surface hover:text-red-500' : 'text-sub hover:bg-surface hover:text-white'}
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
