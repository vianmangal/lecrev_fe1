import React from 'react';

interface FilterButtonProps {
  value: string;
  current: string;
  onChange: (value: string) => void;
}

export const FilterButton: React.FC<FilterButtonProps> = ({ value, current, onChange }) => {
  const active = current === value;
  return (
    <button
      onClick={() => onChange(active ? 'All' : value)}
      className={`
        border px-3 sm:px-4 py-1.5 text-[8px] sm:text-[9px] uppercase tracking-[0.12em] sm:tracking-[0.15em] cursor-pointer transition-all duration-150 rounded-sm
        ${active ? 'border-cyan-primary/50 text-cyan-primary bg-cyan-primary/10' : 'border-border text-sub hover:border-border-md hover:text-neutral-300'}
      `}
    >
      {value}
    </button>
  );
};
