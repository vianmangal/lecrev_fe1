import { Deployment } from './types';

export interface ApiConnection {
  baseUrl: string;
  apiKey: string;
  projectId: string;
}

export type FunctionState = 'building' | 'ready' | 'failed';
export type BuildState = 'queued' | 'running' | 'succeeded' | 'failed';
export type JobState = 'queued' | 'scheduling' | 'assigned' | 'running' | 'retrying' | 'succeeded' | 'failed';

export interface DeploySource {
  type: 'bundle' | 'git';
  bundleBase64?: string;
  inlineFiles?: Record<string, string>;
  gitUrl?: string;
  gitRef?: string;
  subPath?: string;
}

export interface CreateFunctionRequest {
  name: string;
  runtime: string;
  entrypoint: string;
  memoryMb: number;
  timeoutSec: number;
  networkPolicy: 'none' | 'full';
  regions: string[];
  envRefs: string[];
  maxRetries: number;
  idempotencyKey: string;
  source: DeploySource;
}

export interface FunctionVersion {
  id: string;
  projectId: string;
  name: string;
  runtime: string;
  entrypoint: string;
  memoryMb: number;
  timeoutSec: number;
  networkPolicy: 'none' | 'allowlist' | 'full';
  regions: string[];
  envRefs: string[];
  maxRetries: number;
  buildJobId?: string;
  sourceType: 'bundle' | 'git';
  artifactDigest: string;
  state: FunctionState;
  createdAt: string;
}

export interface BuildJob {
  id: string;
  functionVersionId: string;
  targetRegion?: string;
  state: BuildState;
  error?: string;
  logsKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobResult {
  exitCode: number;
  logs: string;
  logsKey?: string;
  output: unknown;
  outputKey?: string;
  hostId: string;
  region: string;
  startedAt: string;
  finishedAt: string;
}

export interface ExecutionJob {
  id: string;
  functionVersionId: string;
  projectId: string;
  targetRegion?: string;
  state: JobState;
  payload: unknown;
  maxRetries: number;
  attemptCount: number;
  lastAttemptId?: string;
  error?: string;
  result?: JobResult;
  createdAt: string;
  updatedAt: string;
}

export interface Region {
  name: string;
  state: string;
  availableHosts: number;
  blankWarm: number;
  functionWarm: number;
  lastHeartbeatAt: string;
  lastError?: string;
}

export interface DeployRequestInput {
  projectId: string;
  name: string;
  environment: Deployment['env'];
  region: string;
  entrypoint: string;
  inlineFiles: Record<string, string>;
}

export interface LiveDeploymentRecord {
  projectId: string;
  environment: Deployment['env'];
  version: FunctionVersion;
  buildJob?: BuildJob;
  buildLogs?: string;
  job?: ExecutionJob;
  jobLogs?: string;
  jobOutput?: unknown;
  error?: string;
}

function normalizeBaseURL(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  return trimmed.replace(/\/+$/, '');
}

function joinURL(baseUrl: string, path: string): string {
  const normalized = normalizeBaseURL(baseUrl);
  if (!normalized) {
    return path;
  }
  return `${normalized}${path}`;
}

async function request<T>(connection: ApiConnection, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(joinURL(connection.baseUrl, path), {
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
  if (!raw) {
    return undefined as T;
  }
  return JSON.parse(raw) as T;
}

async function requestText(connection: ApiConnection, path: string): Promise<string> {
  const response = await fetch(joinURL(connection.baseUrl, path), {
    method: 'GET',
    headers: {
      'X-API-Key': connection.apiKey,
    },
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw.trim() || `GET ${path} failed with ${response.status}`);
  }
  return raw;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function makeIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

export async function createFunctionVersion(connection: ApiConnection, input: DeployRequestInput): Promise<FunctionVersion> {
  const payload: CreateFunctionRequest = {
    name: input.name,
    runtime: 'node22',
    entrypoint: input.entrypoint,
    memoryMb: 128,
    timeoutSec: 30,
    networkPolicy: 'full',
    regions: [input.region],
    envRefs: [],
    maxRetries: 1,
    idempotencyKey: makeIdempotencyKey('ui-deploy'),
    source: {
      type: 'bundle',
      inlineFiles: input.inlineFiles,
    },
  };

  return request<FunctionVersion>(
    connection,
    'POST',
    `/v1/projects/${encodeURIComponent(input.projectId)}/functions`,
    payload,
  );
}

export async function getFunctionVersion(connection: ApiConnection, versionId: string): Promise<FunctionVersion> {
  return request<FunctionVersion>(connection, 'GET', `/v1/functions/${encodeURIComponent(versionId)}`);
}

export async function getBuildJob(connection: ApiConnection, jobId: string): Promise<BuildJob> {
  return request<BuildJob>(connection, 'GET', `/v1/build-jobs/${encodeURIComponent(jobId)}`);
}

export async function getBuildJobLogs(connection: ApiConnection, jobId: string): Promise<string> {
  return requestText(connection, `/v1/build-jobs/${encodeURIComponent(jobId)}/logs`);
}

export async function invokeFunction(connection: ApiConnection, versionId: string, payload: unknown): Promise<ExecutionJob> {
  return request<ExecutionJob>(connection, 'POST', `/v1/functions/${encodeURIComponent(versionId)}/invoke`, {
    payload,
    idempotencyKey: makeIdempotencyKey('ui-invoke'),
  });
}

export async function getJob(connection: ApiConnection, jobId: string): Promise<ExecutionJob> {
  return request<ExecutionJob>(connection, 'GET', `/v1/jobs/${encodeURIComponent(jobId)}`);
}

export async function getJobLogs(connection: ApiConnection, jobId: string): Promise<string> {
  return requestText(connection, `/v1/jobs/${encodeURIComponent(jobId)}/logs`);
}

export async function getJobOutput(connection: ApiConnection, jobId: string): Promise<unknown> {
  return request<unknown>(connection, 'GET', `/v1/jobs/${encodeURIComponent(jobId)}/output`);
}

export async function listRegions(connection: ApiConnection): Promise<Region[]> {
  return request<Region[]>(connection, 'GET', '/v1/regions');
}

export function toAgeLabel(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return 'now';
  }
  const delta = Math.max(0, Date.now() - then);
  const sec = Math.floor(delta / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h`;
  }
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function statusFromRecord(record: LiveDeploymentRecord): Deployment['status'] {
  if (record.error) {
    return 'Failed';
  }
  if (record.job) {
    if (record.job.state === 'succeeded') {
      return 'Active';
    }
    if (record.job.state === 'failed') {
      return 'Failed';
    }
    return 'Building';
  }
  if (record.version.state === 'failed' || record.buildJob?.state === 'failed') {
    return 'Failed';
  }
  if (record.version.state === 'ready' || record.buildJob?.state === 'succeeded') {
    return 'Ready';
  }
  return 'Building';
}

export function toDeploymentRow(record: LiveDeploymentRecord): Deployment {
  const id = record.job?.id || record.buildJob?.id || record.version.id;
  const region = record.job?.result?.region || record.job?.targetRegion || record.buildJob?.targetRegion || record.version.regions[0] || 'ap-south-1';
  const commit = record.version.id.slice(0, 7);
  return {
    id,
    project: record.projectId,
    branch: record.version.sourceType,
    commit,
    env: record.environment,
    status: statusFromRecord(record),
    age: toAgeLabel(record.version.createdAt),
    region,
  };
}