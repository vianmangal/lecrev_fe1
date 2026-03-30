import { ApiConnection, DeploymentSummary, LiveDeploymentRecord } from '../api';
import { Deployment, LogEntry, Project } from '../types';

export const CONNECTION_STORAGE_KEY = 'lecrev.ui.connection';
export const FALLBACK_REGIONS = ['ap-south-1', 'ap-south-2', 'ap-southeast-1'];

export const DEFAULT_CONNECTION: ApiConnection = {
  baseUrl: (import.meta.env.VITE_LECREV_API_BASE_URL ?? '').trim(),
  apiKey: (import.meta.env.VITE_LECREV_API_KEY ?? 'dev-root-key').trim() || 'dev-root-key',
  projectId: (import.meta.env.VITE_LECREV_PROJECT_ID ?? 'demo').trim() || 'demo',
};

export function loadConnection(): ApiConnection {
  try {
    const raw = window.localStorage.getItem(CONNECTION_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CONNECTION;
    }
    const parsed = JSON.parse(raw) as Partial<ApiConnection>;
    return {
      baseUrl: parsed.baseUrl ?? DEFAULT_CONNECTION.baseUrl,
      apiKey: parsed.apiKey ?? DEFAULT_CONNECTION.apiKey,
      projectId: parsed.projectId ?? DEFAULT_CONNECTION.projectId,
    };
  } catch {
    return DEFAULT_CONNECTION;
  }
}

export function persistConnection(connection: ApiConnection): void {
  window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection));
}

export function classifyLogLevel(line: string): LogEntry['level'] {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('failed')) {
    return 'ERROR';
  }
  if (lower.includes('warn')) {
    return 'WARN';
  }
  return 'INFO';
}

export function toLogEntries(raw: string): LogEntry[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 200);

  if (lines.length === 0) {
    return [];
  }

  const now = Date.now();
  return lines.map((line, index) => ({
    t: new Date(now - (lines.length - index) * 1000).toLocaleTimeString('en-GB', { hour12: false }),
    level: classifyLogLevel(line),
    msg: line,
  }));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

function buildProjectURL(name: string): string {
  return `${slugify(name)}.lecrev.app`;
}

export function buildProjectRow(projectID: string, projectName: string, deployments: Deployment[]): Project {
  const latest = deployments[0];
  const activeCount = deployments.filter((row) => row.status === 'Active').length;
  const readyCount = deployments.filter((row) => row.status === 'Ready').length;

  let instances = '0 Instances';
  if (activeCount > 0) {
    instances = `${activeCount} Instance${activeCount === 1 ? '' : 's'}`;
  } else if (readyCount > 0) {
    instances = `${readyCount} Warm`;
  } else if (latest) {
    instances = latest.status;
  }

  return {
    id: projectID,
    name: projectName,
    url: buildProjectURL(projectName || projectID),
    status: latest?.env ?? 'Production',
    instances,
    active: activeCount > 0 || readyCount > 0,
  };
}

export function mergeDeploymentRows(
  backendDeployments: DeploymentSummary[],
  liveDeployments: LiveDeploymentRecord[],
  seedDeployments: Deployment[],
  summaryToDeploymentRow: (summary: DeploymentSummary) => Deployment,
  toDeploymentRow: (record: LiveDeploymentRecord) => Deployment,
): Deployment[] {
  const map = new Map<string, Deployment>();
  const order: string[] = [];

  for (const summary of backendDeployments) {
    const row = summaryToDeploymentRow(summary);
    order.push(row.id);
    map.set(row.id, row);
  }

  for (const record of liveDeployments) {
    const row = toDeploymentRow(record);
    if (!map.has(row.id)) {
      order.unshift(row.id);
    }
    map.set(row.id, row);
  }

  for (const row of seedDeployments) {
    if (!map.has(row.id)) {
      order.push(row.id);
      map.set(row.id, row);
    }
  }

  return order
    .map((id) => map.get(id))
    .filter((row): row is Deployment => Boolean(row));
}
