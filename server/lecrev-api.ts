const apiTarget = (process.env.LECREV_API_TARGET ?? 'http://127.0.0.1:8080').trim().replace(/\/+$/, '');

export interface LecrevServerConnection {
  apiKey: string;
  projectId: string;
}

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

function assertConfigured(connection: LecrevServerConnection) {
  if (!connection.apiKey.trim()) {
    throw new Error('Lecrev API key is not configured for this user session.');
  }
  if (!connection.projectId.trim()) {
    throw new Error('Lecrev project is not configured for this user session.');
  }
}

async function request<T>(connection: LecrevServerConnection, method: string, path: string, body?: unknown): Promise<T> {
  assertConfigured(connection);

  const response = await fetch(`${apiTarget}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': connection.apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw.trim() || `${method} ${path} failed with ${response.status}`);
  }

  return raw ? JSON.parse(raw) as T : (undefined as T);
}

export async function createGitFunctionVersion(connection: LecrevServerConnection, input: CreateGitFunctionVersionInput): Promise<LecrevFunctionVersion> {
  const projectId = input.projectId?.trim() || connection.projectId;
  return request<LecrevFunctionVersion>(connection, 'POST', `/v1/projects/${projectId}/functions`, {
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

export async function getFunctionVersion(connection: LecrevServerConnection, versionId: string): Promise<LecrevFunctionVersion> {
  return request<LecrevFunctionVersion>(connection, 'GET', `/v1/functions/${versionId}`);
}

export async function getBuildJob(connection: LecrevServerConnection, buildJobId: string): Promise<LecrevBuildJob> {
  return request<LecrevBuildJob>(connection, 'GET', `/v1/build-jobs/${buildJobId}`);
}
