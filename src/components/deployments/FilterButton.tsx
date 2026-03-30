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
        border px-4 py-1.5 text-[9px] uppercase tracking-[0.15em] cursor-pointer transition-all duration-150
        ${active ? 'border-border-md text-white bg-surface' : 'border-border text-sub hover:border-border-md hover:text-neutral-300'}
      `}
    >
      {value}
    </button>
  );
};
