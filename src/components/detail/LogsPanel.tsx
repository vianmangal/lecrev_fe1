import React from 'react';
import { LogEntry } from '../../types';

interface LogsPanelProps {
  logs: LogEntry[];
}

export function LogsPanel({ logs }: LogsPanelProps) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em]">
        No logs available
      </div>
    );
  }

  return (
    <>
      {logs.map((log, index) => (
        <div key={`${log.t}-${index}`} className={`flex gap-4 sm:gap-6 p-2.5 items-baseline ${index % 2 === 0 ? 'bg-surface' : 'bg-black'}`}>
          <span className="text-[11px] text-neutral-600 shrink-0 w-[80px] sm:w-[110px]">{log.t}</span>
          <span className={`text-[10px] uppercase tracking-[0.12em] shrink-0 w-11 ${log.level === 'ERROR' ? 'text-red-500' : log.level === 'WARN' ? 'text-amber-500' : 'text-cyan-primary'}`}>
            {log.level}
          </span>
          <span className="text-[12px] text-neutral-200 min-w-0 break-all">{log.msg}</span>
        </div>
      ))}
    </>
  );
}
