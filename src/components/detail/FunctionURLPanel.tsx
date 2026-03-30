import React from 'react';
import { CyanBtn, GhostBtn } from '../UI';
import { HTTPTrigger } from '../../api';

interface FunctionURLPanelProps {
  latestFunctionURL?: HTTPTrigger;
  busy?: boolean;
  error?: string | null;
  onCreate?: () => void;
}

export function FunctionURLPanel({ latestFunctionURL, busy = false, error = null, onCreate }: FunctionURLPanelProps) {
  return (
    <div className="border border-border bg-surface/40 p-4 sm:p-5 mb-8 md:mb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-primary mb-2">Function URL</p>
          {latestFunctionURL ? (
            <>
              <p className="text-sm text-white break-all">{latestFunctionURL.url}</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-sub mt-2">
                Public HTTP entrypoint for the latest ready deployment
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-white">No public URL generated yet.</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-sub mt-2">
                Create one to invoke the latest ready deployment over HTTP like a Lambda Function URL
              </p>
            </>
          )}
          {error && (
            <p className="text-[10px] uppercase tracking-[0.12em] text-red-500 mt-3">{error}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {latestFunctionURL && (
            <>
              <GhostBtn
                small
                onClick={() => {
                  window.navigator.clipboard.writeText(latestFunctionURL.url).catch(() => undefined);
                }}
              >
                Copy URL
              </GhostBtn>
              <GhostBtn
                small
                onClick={() => {
                  window.open(latestFunctionURL.url, '_blank', 'noopener,noreferrer');
                }}
              >
                Open URL
              </GhostBtn>
            </>
          )}
          {onCreate && (
            <CyanBtn onClick={onCreate} className="px-4 py-1.5" disabled={busy}>
              {latestFunctionURL ? 'Refresh URL' : busy ? 'Creating...' : 'Generate URL'}
            </CyanBtn>
          )}
        </div>
      </div>
    </div>
  );
}
