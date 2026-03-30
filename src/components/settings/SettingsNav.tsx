import React from 'react';

interface SettingsNavProps {
  tabs: string[];
  activeTab: string;
  onSelect: (tab: string) => void;
}

export function SettingsNav({ tabs, activeTab, onSelect }: SettingsNavProps) {
  return (
    <nav className="flex flex-row md:flex-col md:w-40 shrink-0 gap-1 md:gap-0 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
      <p className="hidden md:block text-[10px] uppercase tracking-[0.15em] text-sub mb-4">Settings</p>
      {tabs.map((tab) => {
        const key = tab.toLowerCase().replace(' ', '_');
        const active = activeTab === key;
        const isDanger = tab === 'Danger Zone';
        return (
          <button
            key={tab}
            onClick={() => onSelect(key)}
            className={`
              block shrink-0 text-left text-[10px] uppercase tracking-[0.12em] bg-transparent border-none border-l py-2.5 pl-4 cursor-pointer transition-all duration-150 whitespace-nowrap
              ${active
                ? (isDanger ? 'border-red-500 text-red-500' : 'border-white text-white')
                : (isDanger ? 'border-border text-red-500/50' : 'border-border text-sub hover:text-neutral-300')}
            `}
          >
            {tab}
          </button>
        );
      })}
    </nav>
  );
}
