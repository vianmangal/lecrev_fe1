const apiTarget = (process.env.LECREV_API_TARGET ?? 'http://127.0.0.1:8080').trim().replace(/\/+$/, '');
const apiKey = (process.env.LECREV_API_KEY ?? process.env.VITE_LECREV_API_KEY ?? '').trim();
const defaultProjectID = (process.env.LECREV_DEFAULT_PROJECT_ID ?? process.env.VITE_LECREV_PROJECT_ID ?? 'demo').trim() || 'demo';

export interface LecrevFunctionVersion {
  id: string;
  buildJobId?: string;
  state: 'building' | 'ready' | 'failed';
}

export interface LecrevBuildJob {
  id: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
}

export interface CreateGitFunctionVersionInput {
  projectId?: string;
  name: string;
  environment: 'production' | 'staging' | 'preview';
  region: string;
  entrypoint: string;
  gitUrl: string;
  gitRef: string;
  idempotencyKey: string;
}

function assertConfigured() {
  if (!apiKey) {
    throw new Error('Lecrev API key is not configured. Set LECREV_API_KEY or VITE_LECREV_API_KEY.');
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  assertConfigured();

  const response = await fetch(`${apiTarget}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw.trim() || `${method} ${path} failed with ${response.status}`);
  }

  return raw ? JSON.parse(raw) as T : (undefined as T);
}

export function getLecrevDefaultProjectID(): string {
  return defaultProjectID;
}

export async function createGitFunctionVersion(input: CreateGitFunctionVersionInput): Promise<LecrevFunctionVersion> {
  const projectId = input.projectId?.trim() || defaultProjectID;
  return request<LecrevFunctionVersion>('POST', `/v1/projects/${projectId}/functions`, {
    name: input.name,
    environment: input.environment,
    runtime: 'node22',
    entrypoint: input.entrypoint,
    memoryMb: 256,
    timeoutSec: 30,
    networkPolicy: 'none',
    regions: [input.region],
    envRefs: [],
    maxRetries: 2,
    idempotencyKey: input.idempotencyKey,
    source: {
      type: 'git',
      gitUrl: input.gitUrl,
      gitRef: input.gitRef,
      metadata: {
        environment: input.environment,
      },
    },
  });
}

export async function getFunctionVersion(versionId: string): Promise<LecrevFunctionVersion> {
  return request<LecrevFunctionVersion>('GET', `/v1/functions/${versionId}`);
}

export async function getBuildJob(buildJobId: string): Promise<LecrevBuildJob> {
  return request<LecrevBuildJob>('GET', `/v1/build-jobs/${buildJobId}`);
}
