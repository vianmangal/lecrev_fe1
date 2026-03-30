import { useEffect, useMemo, useState } from 'react';
import { ApiConnection, LiveDeploymentRecord, getDeploymentLogs } from '../api';
import { LogEntry } from '../types';
import { toLogEntries } from '../lib/dashboard-utils';

export function useDetailLogs(
  connection: ApiConnection,
  activeTab: string,
  deploymentID: string | undefined,
  liveDeployments: LiveDeploymentRecord[],
): LogEntry[] | undefined {
  const [deploymentLogCache, setDeploymentLogCache] = useState<Record<string, string>>({});
  const [detailLogText, setDetailLogText] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'logs' || !deploymentID) {
      setDetailLogText(null);
      return;
    }

    const liveRecord = liveDeployments.find((record) => record.version.id === deploymentID);
    const fallbackRaw = liveRecord?.jobLogs || liveRecord?.buildLogs || liveRecord?.error || null;
    const cached = deploymentLogCache[deploymentID];

    if (cached) {
      setDetailLogText(cached);
      return;
    }

    setDetailLogText(fallbackRaw);

    let cancelled = false;
    void getDeploymentLogs(connection, deploymentID)
      .then((raw) => {
        if (cancelled) {
          return;
        }
        setDeploymentLogCache((prev) => ({
          ...prev,
          [deploymentID]: raw,
        }));
        setDetailLogText(raw);
      })
      .catch(() => {
        if (!cancelled && !fallbackRaw) {
          setDetailLogText(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, connection, deploymentID, deploymentLogCache, liveDeployments]);

  return useMemo<LogEntry[] | undefined>(() => {
    if (!detailLogText) {
      return undefined;
    }
    const parsed = toLogEntries(detailLogText);
    return parsed.length > 0 ? parsed : undefined;
  }, [detailLogText]);
}
