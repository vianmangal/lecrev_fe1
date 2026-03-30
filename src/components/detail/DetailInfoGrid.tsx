import React from 'react';

interface DetailInfoGridProps {
  rows: Array<[string, string]>;
}

export function DetailInfoGrid({ rows }: DetailInfoGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 md:mb-12">
      {rows.map(([key, value]) => (
        <div key={key}>
          <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1.5">{key}</p>
          <p className="text-[13px]">{value}</p>
        </div>
      ))}
    </div>
  );
}
