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
  labels?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface CreateFunctionRequest {
  name: string;
  environment?: string;
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
  metadata?: Record<string, string>;
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

export interface ProjectRecord {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export interface BuildJobSummary {
  id: string;
  functionVersionId: string;
  targetRegion?: string;
  state: BuildState;
  error?: string;
  logsReady: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionResultSummary {
  exitCode: number;
  hostId: string;
  region: string;
  startedAt: string;
  finishedAt: string;
  logsReady: boolean;
  outputReady: boolean;
}

export interface ExecutionJobSummary {
  id: string;
  functionVersionId: string;
  targetRegion?: string;
  state: JobState;
  maxRetries: number;
  attemptCount: number;
  lastAttemptId?: string;
  error?: string;
  result?: ExecutionResultSummary;
  createdAt: string;
  updatedAt: string;
}

export interface HTTPTrigger {
  token: string;
  projectId: string;
  functionVersionId: string;
  description?: string;
  authMode: 'none';
  enabled: boolean;
  url: string;
  createdAt: string;
}

export interface DeploymentSummary {
  id: string;
  projectId: string;
  projectName: string;
  functionVersionId: string;
  name: string;
  runtime: string;
  sourceType: 'bundle' | 'git';
  environment?: string;
  branch?: string;
  commitSha?: string;
  gitUrl?: string;
  status: string;
  functionState: FunctionState;
  regions: string[];
  build?: BuildJobSummary;
  lastJob?: ExecutionJobSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ListDeploymentsOptions {
  limit?: number;
  status?: string;
  environment?: string;
}

export interface DeployRequestInput {
  projectId: string;
  name: string;
  environment: Deployment['env'];
  region: string;
  entrypoint: string;
  inlineFiles?: Record<string, string>;
  gitUrl?: string;
  gitRef?: string;
  subPath?: string;
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

export interface CreateHTTPTriggerRequest {
  description?: string;
  token?: string;
  authMode?: 'none';
}

function normalizeBaseURL(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function joinURL(baseUrl: string, path: string): string {
  const normalized = normalizeBaseURL(baseUrl);
  if (!normalized) {
    return path;
  }
  return `${normalized}${path}`;
}

function buildQuery(options?: ListDeploymentsOptions): string {
  if (!options) {
    return '';
  }
  const params = new URLSearchParams();
  if (options.limit && options.limit > 0) {
    params.set('limit', String(options.limit));
  }
  const status = options.status?.trim().toLowerCase();
  if (status && status !== 'all') {
    params.set('status', status);
  }
  const environment = options.environment?.trim().toLowerCase();
  if (environment && environment !== 'all') {
    params.set('environment', environment);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
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

export function normalizeEnvironment(value?: string): Deployment['env'] {
  switch (value?.trim().toLowerCase()) {
    case 'staging':
      return 'Staging';
    case 'preview':
      return 'Preview';
    default:
      return 'Production';
  }
}

export function normalizeDeploymentStatus(value?: string): Deployment['status'] {
  switch (value?.trim().toLowerCase()) {
    case 'active':
    case 'succeeded':
      return 'Active';
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
    default:
      return 'Building';
  }
}

export function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) {
    return 'now';
  }
  const millis = Date.parse(timestamp);
  if (!Number.isFinite(millis)) {
    return 'now';
  }
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - millis) / 1000));
  if (deltaSeconds < 5) {
    return 'now';
  }
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s`;
  }
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m`;
  }
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h`;
  }
  return `${Math.floor(deltaHours / 24)}d`;
}

function compactRef(value?: string, fallback = 'inline'): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.slice(0, 7);
}

function inferLiveStatus(record: LiveDeploymentRecord): Deployment['status'] {
  if (record.error || record.version.state === 'failed' || record.buildJob?.state === 'failed' || record.job?.state === 'failed') {
    return 'Failed';
  }
  if (record.job?.state === 'succeeded') {
    return 'Active';
  }
  if (record.version.state === 'ready') {
    return 'Ready';
  }
  return 'Building';
}

export function summaryToDeploymentRow(summary: DeploymentSummary): Deployment {
  return {
    id: summary.id,
    project: summary.projectName || summary.projectId,
    branch: summary.branch?.trim() || (summary.sourceType === 'git' ? 'git' : 'inline'),
    commit: compactRef(summary.commitSha, compactRef(summary.functionVersionId, 'inline')),
    env: normalizeEnvironment(summary.environment),
    status: normalizeDeploymentStatus(summary.status),
    age: formatRelativeTime(summary.updatedAt || summary.createdAt),
    region: summary.lastJob?.result?.region || summary.lastJob?.targetRegion || summary.build?.targetRegion || summary.regions[0] || 'ap-south-1',
  };
}

export function toDeploymentRow(record: LiveDeploymentRecord): Deployment {
  return {
    id: record.version.id,
    project: record.projectId,
    branch: record.buildJob?.metadata?.branch?.trim() || (record.version.sourceType === 'git' ? 'git' : 'inline'),
    commit: compactRef(record.buildJob?.metadata?.commitSha, compactRef(record.version.artifactDigest, compactRef(record.version.id, 'inline'))),
    env: record.environment,
    status: inferLiveStatus(record),
    age: formatRelativeTime(record.job?.updatedAt || record.buildJob?.updatedAt || record.version.createdAt),
    region: record.job?.result?.region || record.job?.targetRegion || record.buildJob?.targetRegion || record.version.regions[0] || 'ap-south-1',
  };
}

export async function listRegions(connection: ApiConnection): Promise<Region[]> {
  return request<Region[]>(connection, 'GET', '/v1/regions');
}

export async function listProjects(connection: ApiConnection): Promise<ProjectRecord[]> {
  return request<ProjectRecord[]>(connection, 'GET', '/v1/projects');
}

export async function listDeployments(connection: ApiConnection, options?: ListDeploymentsOptions): Promise<DeploymentSummary[]> {
  return request<DeploymentSummary[]>(connection, 'GET', `/v1/deployments${buildQuery(options)}`);
}

export async function listProjectDeployments(connection: ApiConnection, projectId: string, options?: ListDeploymentsOptions): Promise<DeploymentSummary[]> {
  return request<DeploymentSummary[]>(connection, 'GET', `/v1/projects/${projectId}/deployments${buildQuery(options)}`);
}

export async function getDeployment(connection: ApiConnection, deploymentId: string): Promise<DeploymentSummary> {
  return request<DeploymentSummary>(connection, 'GET', `/v1/deployments/${deploymentId}`);
}

export async function getDeploymentLogs(connection: ApiConnection, deploymentId: string): Promise<string> {
  return requestText(connection, `/v1/deployments/${deploymentId}/logs`);
}

export async function getDeploymentOutput(connection: ApiConnection, deploymentId: string): Promise<unknown> {
  return request<unknown>(connection, 'GET', `/v1/deployments/${deploymentId}/output`);
}

export async function getFunctionVersion(connection: ApiConnection, versionId: string): Promise<FunctionVersion> {
  return request<FunctionVersion>(connection, 'GET', `/v1/functions/${versionId}`);
}

export async function getBuildJob(connection: ApiConnection, jobId: string): Promise<BuildJob> {
  return request<BuildJob>(connection, 'GET', `/v1/build-jobs/${jobId}`);
}

export async function getBuildJobLogs(connection: ApiConnection, jobId: string): Promise<string> {
  return requestText(connection, `/v1/build-jobs/${jobId}/logs`);
}

export async function getJob(connection: ApiConnection, jobId: string): Promise<ExecutionJob> {
  return request<ExecutionJob>(connection, 'GET', `/v1/jobs/${jobId}`);
}

export async function getJobLogs(connection: ApiConnection, jobId: string): Promise<string> {
  return requestText(connection, `/v1/jobs/${jobId}/logs`);
}

export async function getJobOutput(connection: ApiConnection, jobId: string): Promise<unknown> {
  return request<unknown>(connection, 'GET', `/v1/jobs/${jobId}/output`);
}

export async function listHTTPTriggers(connection: ApiConnection, versionId: string): Promise<HTTPTrigger[]> {
  return request<HTTPTrigger[]>(connection, 'GET', `/v1/functions/${versionId}/triggers/http`);
}

export async function createHTTPTrigger(
  connection: ApiConnection,
  versionId: string,
  body: CreateHTTPTriggerRequest = {},
): Promise<HTTPTrigger> {
  return request<HTTPTrigger>(connection, 'POST', `/v1/functions/${versionId}/triggers/http`, body);
}

export async function createFunctionVersion(connection: ApiConnection, input: DeployRequestInput): Promise<FunctionVersion> {
  const source: DeploySource = input.gitUrl
    ? {
        type: 'git',
        gitUrl: input.gitUrl,
        gitRef: input.gitRef,
        subPath: input.subPath,
      }
    : {
        type: 'bundle',
        inlineFiles: input.inlineFiles,
      };

  const body: CreateFunctionRequest = {
    name: input.name,
    environment: input.environment.toLowerCase(),
    runtime: 'node22',
    entrypoint: input.entrypoint,
    memoryMb: 256,
    timeoutSec: 30,
    networkPolicy: 'none',
    regions: [input.region],
    envRefs: [],
    maxRetries: 2,
    idempotencyKey: makeIdempotencyKey('deploy'),
    source,
  };

  return request<FunctionVersion>(connection, 'POST', `/v1/projects/${input.projectId}/functions`, body);
}

export async function invokeFunction(connection: ApiConnection, versionId: string, payload: unknown): Promise<ExecutionJob> {
  return request<ExecutionJob>(connection, 'POST', `/v1/functions/${versionId}/invoke`, {
    payload,
    idempotencyKey: makeIdempotencyKey('invoke'),
  });
}
