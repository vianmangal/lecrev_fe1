import React from 'react';
import { FilterButton } from '../deployments/FilterButton';

export interface FilterConfig {
  id: string;
  current: string;
  onChange: (value: string) => void;
  options: string[];
}

export interface StatusFilterConfig {
  id: string;
  current: string;
  onChange: (value: string) => void;
  options: string[];
}

interface PageLayoutProps {
  title: string;
  count: number;
  totalCount?: number;
  filters?: FilterConfig[];
  statusFilters?: StatusFilterConfig[];
  showFilterPlaceholder?: boolean;
  children: React.ReactNode;
}

const CONTENT_PADDING = 'p-4 sm:p-8 md:p-12';
const HEADER_ROW = 'flex items-center justify-between border-b border-border pb-3';
const HEADER_TITLE = 'text-xl uppercase tracking-tight text-sub font-normal';
const HEADER_COUNT = 'text-[10px] uppercase tracking-[0.15em] text-sub';
const FILTER_BLOCK = 'mt-6 pb-6 border-b border-border';

function FilterRow({ groups, alignRight = false }: { groups: Array<FilterConfig | StatusFilterConfig>; alignRight?: boolean }) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${alignRight ? 'sm:ml-auto' : ''}`}>
      {groups.map((group) => (
        <div key={group.id} className="flex flex-wrap gap-2">
          {group.options.map((option) => (
            <FilterButton key={`${group.id}-${option}`} value={option} current={group.current} onChange={group.onChange} />
          ))}
        </div>
      ))}
    </div>
  );
}

function FilterPlaceholder() {
  return (
    <div className="flex gap-2 flex-wrap">
      <span className="h-8 px-4 inline-flex items-center rounded-sm border border-border text-[9px] uppercase tracking-[0.15em] text-sub opacity-70">
        All
      </span>
      <span className="h-8 px-4 inline-flex items-center rounded-sm border border-border text-[9px] uppercase tracking-[0.15em] text-sub opacity-70">
        Team
      </span>
      <span className="h-8 px-4 inline-flex items-center rounded-sm border border-border text-[9px] uppercase tracking-[0.15em] text-sub opacity-70">
        Personal
      </span>
      <div className="w-full sm:w-auto sm:ml-auto flex gap-2">
        <span className="h-8 px-4 inline-flex items-center rounded-sm border border-border text-[9px] uppercase tracking-[0.15em] text-sub opacity-60">
          Active
        </span>
        <span className="h-8 px-4 inline-flex items-center rounded-sm border border-border text-[9px] uppercase tracking-[0.15em] text-sub opacity-60">
          Archived
        </span>
      </div>
    </div>
  );
}

export function PageLayout({
  title,
  count,
  totalCount,
  filters = [],
  statusFilters = [],
  showFilterPlaceholder = false,
  children,
}: PageLayoutProps) {
  const normalizedTotal = typeof totalCount === 'number' ? totalCount : count;
  const hasFilters = filters.length > 0 || statusFilters.length > 0;

  return (
    <div className={`flex-1 overflow-y-auto ${CONTENT_PADDING}`}>
      <div className={HEADER_ROW}>
        <h2 className={HEADER_TITLE}>{title}</h2>
        <span className={HEADER_COUNT}>{count} / {normalizedTotal} shown</span>
      </div>

      <div className={FILTER_BLOCK}>
        {hasFilters ? (
          <div className="flex gap-2 flex-wrap">
            <FilterRow groups={filters} />
            <FilterRow groups={statusFilters} alignRight />
          </div>
        ) : showFilterPlaceholder ? (
          <FilterPlaceholder />
        ) : null}
      </div>

      {children}
    </div>
  );
}
