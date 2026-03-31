const apiTarget = (process.env.LECREV_API_TARGET ?? 'http://127.0.0.1:8080').trim().replace(/\/+$/, '');

export interface LecrevServerConnection {
  apiKey: string;
  projectId?: string;
}

export interface LecrevFunctionVersion {
  id: string;
  buildJobId?: string;
  state: 'building' | 'ready' | 'failed';
}

export interface LecrevProject {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export interface LecrevBuildJob {
  id: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
}

export interface LecrevHTTPTrigger {
  token: string;
  projectId: string;
  functionVersionId: string;
  description?: string;
  authMode: 'none' | 'api_key';
  enabled: boolean;
  url: string;
  createdAt: string;
}

export interface CreateGitFunctionVersionInput {
  projectId?: string;
  name: string;
  environment: 'production' | 'staging' | 'preview';
  region: string;
  entrypoint: string;
  subPath?: string;
  deliveryKind?: 'function' | 'website';
  framework?: string;
  networkPolicy?: 'none' | 'full';
  envVars?: Record<string, string>;
  gitUrl: string;
  gitRef: string;
  idempotencyKey: string;
}

function assertConfigured(connection: LecrevServerConnection) {
  if (!connection.apiKey.trim()) {
    throw new Error('Lecrev API key is not configured for this user session.');
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
  const projectId = input.projectId?.trim() || connection.projectId?.trim();
  if (!projectId) {
    throw new Error('Lecrev project is not configured for this user session.');
  }
  const isWebsite = input.deliveryKind === 'website' || input.framework === 'nextjs' || input.entrypoint.trim() === '';
  return request<LecrevFunctionVersion>(connection, 'POST', `/v1/projects/${projectId}/functions`, {
    name: input.name,
    environment: input.environment,
    runtime: 'node22',
    entrypoint: input.entrypoint,
    memoryMb: 256,
    timeoutSec: 30,
    networkPolicy: input.networkPolicy ?? (isWebsite ? 'full' : 'none'),
    regions: [input.region],
    envVars: input.envVars,
    envRefs: [],
    maxRetries: 2,
    idempotencyKey: input.idempotencyKey,
    source: {
      type: 'git',
      gitUrl: input.gitUrl,
      gitRef: input.gitRef,
      subPath: input.subPath,
      metadata: {
        environment: input.environment,
        deliveryKind: input.deliveryKind,
        framework: input.framework,
      },
    },
  });
}

export async function listProjects(connection: LecrevServerConnection): Promise<LecrevProject[]> {
  return request<LecrevProject[]>(connection, 'GET', '/v1/projects');
}

export async function getProject(connection: LecrevServerConnection, projectId: string): Promise<LecrevProject> {
  return request<LecrevProject>(connection, 'GET', `/v1/projects/${projectId}`);
}

export async function createProject(connection: LecrevServerConnection, input: { id?: string; name: string }): Promise<LecrevProject> {
  return request<LecrevProject>(connection, 'POST', '/v1/projects', {
    id: input.id?.trim() || undefined,
    name: input.name,
  });
}

export async function getFunctionVersion(connection: LecrevServerConnection, versionId: string): Promise<LecrevFunctionVersion> {
  return request<LecrevFunctionVersion>(connection, 'GET', `/v1/functions/${versionId}`);
}

export async function getBuildJob(connection: LecrevServerConnection, buildJobId: string): Promise<LecrevBuildJob> {
  return request<LecrevBuildJob>(connection, 'GET', `/v1/build-jobs/${buildJobId}`);
}

export async function listFunctionURLs(connection: LecrevServerConnection, versionId: string): Promise<LecrevHTTPTrigger[]> {
  return request<LecrevHTTPTrigger[]>(connection, 'GET', `/v1/functions/${versionId}/triggers/http`);
}
