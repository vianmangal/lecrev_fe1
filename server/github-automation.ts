import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import {
  CreateGitFunctionVersionInput,
  createGitFunctionVersion,
  getBuildJob,
  getFunctionVersion,
  getProject,
  listFunctionURLs,
  LecrevServerConnection,
} from './lecrev-api';
import {
  createGitHubDeploymentRun,
  findBindingsForPreview,
  findBindingsForPush,
  getGitHubUserConnection,
  GitHubDeploymentRun,
  GitHubRepoBinding,
  listGitHubRepoBindingsByUser,
  listPendingGitHubDeploymentRuns,
  markGitHubDeploymentRunState,
  upsertGitHubRepoBinding,
} from './github-deployments-store';
import { getAuthenticatedSessionUser } from './auth-session';
import { loadAuthorizedRepository } from './github-app';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const githubAppID = (process.env.GITHUB_APP_ID ?? '').trim();
const githubPrivateKeyPath = (process.env.GITHUB_PRIVATE_KEY_PATH ?? '').trim();
const githubWebhookSecret = (process.env.GITHUB_WEBHOOK_SECRET ?? '').trim();
const publicAPIBaseURL = (process.env.LECREV_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
const githubStatusContext = (process.env.GITHUB_STATUS_CONTEXT ?? 'lecrev/deploy').trim() || 'lecrev/deploy';

const isGitHubAppReady = Boolean(githubAppID && githubPrivateKeyPath);

interface GitHubRepositoryRefPayload {
  full_name?: string;
  clone_url?: string;
  private?: boolean;
  owner?: {
    login?: string;
  };
  name?: string;
}

interface GitHubPushPayload {
  ref?: string;
  after?: string;
  installation?: {
    id?: number;
  };
  repository?: {
    name?: string;
    full_name?: string;
    clone_url?: string;
    owner?: {
      login?: string;
    };
  };
}

interface GitHubPullRequestPayload {
  action?: string;
  installation?: {
    id?: number;
  };
  number?: number;
  repository?: {
    name?: string;
    full_name?: string;
    owner?: {
      login?: string;
    };
  };
  pull_request?: {
    html_url?: string;
    title?: string;
    head?: {
      ref?: string;
      sha?: string;
      repo?: GitHubRepositoryRefPayload;
    };
    base?: {
      ref?: string;
      sha?: string;
      repo?: GitHubRepositoryRefPayload;
    };
  };
}

interface GitHubIssueCommentPayload {
  id: number;
  body?: string;
}

function base64URL(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createAppJWT(): string {
  if (!isGitHubAppReady) {
    throw new Error('GitHub App is not configured.');
  }

  const privateKey = fs.readFileSync(githubPrivateKeyPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const header = base64URL(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64URL(JSON.stringify({
    iat: now - 60,
    exp: now + (9 * 60),
    iss: githubAppID,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${payload}.${signature}`;
}

async function githubRequest<T>(path: string, init: RequestInit = {}, authToken?: string): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'lecrev-github-automation',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw || `GitHub API request failed with ${response.status}`);
  }
  return raw ? JSON.parse(raw) as T : (undefined as T);
}

async function createInstallationToken(installationID: number): Promise<string> {
  const payload = await githubRequest<{ token: string }>(
    `/app/installations/${installationID}/access_tokens`,
    { method: 'POST' },
    createAppJWT(),
  );
  return payload.token;
}

function computeWebhookSignature(rawBody: Buffer): string {
  return `sha256=${crypto.createHmac('sha256', githubWebhookSecret).update(rawBody).digest('hex')}`;
}

function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!githubWebhookSecret || !signature) {
    return false;
  }

  const expected = computeWebhookSignature(rawBody);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function normalizeBranchRef(ref: string | undefined): string {
  if (!ref) {
    return '';
  }
  return ref.replace(/^refs\/heads\//, '');
}

function sanitizeFunctionName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'github-function';
}

function previewFunctionName(base: string, prNumber: number): string {
  return sanitizeFunctionName(`${base}-pr-${prNumber}`);
}

function statusContextForRun(input: { eventType: 'push' | 'pull_request'; environment: 'production' | 'staging' | 'preview' }): string {
  if (input.eventType === 'pull_request' || input.environment === 'preview') {
    return 'lecrev/preview';
  }
  if (input.environment === 'staging') {
    return 'lecrev/staging';
  }
  return githubStatusContext;
}

function previewCommentMarker(bindingId: string, prNumber: number): string {
  return `<!-- lecrev-preview binding:${bindingId} pr:${prNumber} -->`;
}

function buildPreviewCommentBody(input: {
  marker: string;
  owner: string;
  repo: string;
  gitRef: string;
  commitSha: string;
  state: 'pending' | 'success' | 'failure' | 'error';
  functionName: string;
  message: string;
  previewURL?: string;
  buildURL?: string;
}): string {
  const lines = [
    input.marker,
    '### Lecrev Preview',
    '',
    `- Function: \`${input.functionName}\``,
    `- Repository: \`${input.owner}/${input.repo}\``,
    `- Ref: \`${input.gitRef}\``,
    `- Commit: \`${input.commitSha.slice(0, 12)}\``,
    `- Status: **${input.state.toUpperCase()}**`,
    `- Details: ${input.message}`,
  ];
  if (input.previewURL) {
    lines.push(`- Preview Function URL: ${input.previewURL}`);
  }
  if (input.buildURL) {
    lines.push(`- Build Details: ${input.buildURL}`);
  }
  return lines.join('\n');
}

function buildTargetURL(buildJobId?: string, functionVersionId?: string): string | undefined {
  if (!publicAPIBaseURL) {
    return undefined;
  }
  if (buildJobId) {
    return `${publicAPIBaseURL}/v1/build-jobs/${buildJobId}`;
  }
  if (functionVersionId) {
    return `${publicAPIBaseURL}/v1/functions/${functionVersionId}`;
  }
  return publicAPIBaseURL;
}

function canonicalGitURL(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

function addInstallationTokenToGitURL(gitURL: string, token: string): string {
  const parsed = new URL(gitURL);
  parsed.username = 'x-access-token';
  parsed.password = token;
  return parsed.toString();
}

async function resolveRepositoryInstallationID(owner: string, repo: string): Promise<number | null> {
  try {
    const payload = await githubRequest<{ id?: number }>(`/repos/${owner}/${repo}/installation`, {}, createAppJWT());
    return payload.id ? Number(payload.id) : null;
  } catch {
    return null;
  }
}

async function buildAuthenticatedGitURL(input: { installationId?: number | null; owner: string; repo: string; fallbackGitURL?: string }): Promise<string> {
  const canonical = input.fallbackGitURL?.trim() || canonicalGitURL(input.owner, input.repo);
  if (!input.installationId || input.installationId <= 0) {
    return canonical;
  }
  const token = await createInstallationToken(input.installationId);
  return addInstallationTokenToGitURL(canonical, token);
}

async function resolveCommitSHA(installationId: number, owner: string, repo: string, gitRef: string): Promise<string> {
  const token = await createInstallationToken(installationId);
  const payload = await githubRequest<{ sha?: string }>(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(gitRef)}`,
    {},
    token,
  );
  if (!payload.sha) {
    throw new Error(`Unable to resolve commit SHA for ${owner}/${repo}@${gitRef}.`);
  }
  return payload.sha;
}

function connectionForUser(userId: string): LecrevServerConnection {
  const connection = getGitHubUserConnection(userId);
  if (!connection) {
    throw new Error(`No Lecrev tenant connection exists for user ${userId}.`);
  }

  return {
    apiKey: connection.apiKey,
    projectId: connection.projectId,
  };
}

async function validateProjectAccess(connection: LecrevServerConnection, projectId: string): Promise<void> {
  await getProject(connection, projectId);
}

async function postCommitStatus(installationId: number, owner: string, repo: string, commitSha: string, input: {
  state: 'pending' | 'success' | 'failure' | 'error';
  description: string;
  targetUrl?: string;
  context?: string;
}): Promise<void> {
  const token = await createInstallationToken(installationId);
  await githubRequest(
    `/repos/${owner}/${repo}/statuses/${commitSha}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: input.state,
        context: input.context ?? githubStatusContext,
        description: input.description,
        target_url: input.targetUrl,
      }),
    },
    token,
  );
}

async function postCommitStatusBestEffort(installationId: number, owner: string, repo: string, commitSha: string, input: {
  state: 'pending' | 'success' | 'failure' | 'error';
  description: string;
  targetUrl?: string;
  context?: string;
}): Promise<void> {
  try {
    await postCommitStatus(installationId, owner, repo, commitSha, input);
  } catch (error) {
    console.warn('[github-automation] commit status update failed', {
      installationId,
      owner,
      repo,
      commitSha,
      state: input.state,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function listIssueComments(installationId: number, owner: string, repo: string, issueNumber: number): Promise<GitHubIssueCommentPayload[]> {
  const token = await createInstallationToken(installationId);
  return githubRequest<GitHubIssueCommentPayload[]>(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    {},
    token,
  );
}

async function createIssueComment(installationId: number, owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
  const token = await createInstallationToken(installationId);
  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    },
    token,
  );
}

async function updateIssueComment(installationId: number, owner: string, repo: string, commentId: number, body: string): Promise<void> {
  const token = await createInstallationToken(installationId);
  await githubRequest(
    `/repos/${owner}/${repo}/issues/comments/${commentId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    },
    token,
  );
}

async function upsertPreviewCommentBestEffort(input: {
  installationId: number;
  owner: string;
  repo: string;
  prNumber: number;
  marker: string;
  body: string;
}): Promise<void> {
  try {
    const comments = await listIssueComments(input.installationId, input.owner, input.repo, input.prNumber);
    const existing = comments.find((comment) => comment.body?.includes(input.marker));
    if (existing?.id) {
      await updateIssueComment(input.installationId, input.owner, input.repo, existing.id, input.body);
      return;
    }
    await createIssueComment(input.installationId, input.owner, input.repo, input.prNumber, input.body);
  } catch (error) {
    console.warn('[github-automation] preview comment update failed', {
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      prNumber: input.prNumber,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function createDeploymentRun(input: {
  binding: GitHubRepoBinding;
  owner: string;
  repo: string;
  repoFullName: string;
  gitUrl: string;
  gitRef: string;
  installationId: number;
  commitSha: string;
  eventType: 'push' | 'pull_request';
  environment: 'production' | 'staging' | 'preview';
  functionName: string;
  prNumber?: number;
}): Promise<GitHubDeploymentRun> {
  const connection = connectionForUser(input.binding.userId);
  await validateProjectAccess(connection, input.binding.projectId);

  const deployInput: CreateGitFunctionVersionInput = {
    projectId: input.binding.projectId,
    name: input.functionName,
    environment: input.environment,
    region: input.binding.region,
    entrypoint: input.binding.entrypoint,
    gitUrl: await buildAuthenticatedGitURL({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      fallbackGitURL: input.gitUrl,
    }),
    gitRef: input.gitRef,
    idempotencyKey: input.eventType === 'pull_request'
      ? `github-pr-${input.binding.id}-${input.prNumber ?? 0}-${input.commitSha}`
      : `github-push-${input.binding.id}-${input.commitSha}`,
  };

  const version = await createGitFunctionVersion(connection, deployInput);
  const statusContext = statusContextForRun({
    eventType: input.eventType,
    environment: input.environment,
  });
  const targetUrl = buildTargetURL(version.buildJobId, version.id);

  if (input.eventType === 'push') {
    upsertGitHubRepoBinding({
      userId: input.binding.userId,
      tenantId: input.binding.tenantId,
      installationId: input.binding.installationId,
      owner: input.binding.owner,
      repo: input.binding.repo,
      repoFullName: input.binding.repoFullName,
      gitUrl: input.binding.gitUrl,
      gitRef: input.binding.gitRef,
      entrypoint: input.binding.entrypoint,
      projectId: input.binding.projectId,
      functionName: input.binding.functionName,
      environment: input.binding.environment,
      region: input.binding.region,
      autoDeploy: input.binding.autoDeploy,
      lastFunctionVersionId: version.id,
      lastBuildJobId: version.buildJobId,
      lastCommitSha: input.commitSha,
    });
  }

  return createGitHubDeploymentRun({
    bindingId: input.binding.id,
    userId: input.binding.userId,
    tenantId: input.binding.tenantId,
    projectId: input.binding.projectId,
    installationId: input.installationId,
    owner: input.owner,
    repo: input.repo,
    repoFullName: input.repoFullName,
    gitRef: input.gitRef,
    commitSha: input.commitSha,
    eventType: input.eventType,
    environment: input.environment,
    prNumber: input.prNumber,
    functionVersionId: version.id,
    buildJobId: version.buildJobId,
    statusContext,
    targetUrl,
  });
}

async function handlePushWebhook(payload: GitHubPushPayload): Promise<{
  repository: string;
  ref: string;
  matchedBindings: number;
  accepted: Array<{ bindingId: string; functionName: string; functionVersionId: string; buildJobId?: string }>;
  failed: Array<{ bindingId: string; functionName: string; error: string }>;
}> {
  const installationId = Number(payload.installation?.id ?? 0);
  const owner = payload.repository?.owner?.login ?? '';
  const repo = payload.repository?.name ?? '';
  const repoFullName = payload.repository?.full_name ?? `${owner}/${repo}`;
  const branch = normalizeBranchRef(payload.ref);
  const commitSha = `${payload.after ?? ''}`.trim();

  if (!installationId || !owner || !repo || !branch || !commitSha) {
    throw new Error('Push webhook payload is missing installation, repository, ref, or commit SHA.');
  }

  const bindings = findBindingsForPush(installationId, owner, repo, branch);
  const accepted: Array<{ bindingId: string; functionName: string; functionVersionId: string; buildJobId?: string }> = [];
  const failed: Array<{ bindingId: string; functionName: string; error: string }> = [];

  for (const binding of bindings) {
    const statusContext = statusContextForRun({ eventType: 'push', environment: binding.environment });
    try {
      await postCommitStatusBestEffort(binding.installationId, binding.owner, binding.repo, commitSha, {
        state: 'pending',
        description: `Lecrev ${binding.environment} deployment queued`,
        context: statusContext,
      });

      const run = await createDeploymentRun({
        binding,
        owner: binding.owner,
        repo: binding.repo,
        repoFullName: binding.repoFullName,
        gitUrl: binding.gitUrl,
        gitRef: binding.gitRef,
        installationId: binding.installationId,
        commitSha,
        eventType: 'push',
        environment: binding.environment,
        functionName: binding.functionName,
      });
      accepted.push({
        bindingId: run.bindingId,
        functionName: binding.functionName,
        functionVersionId: run.functionVersionId,
        buildJobId: run.buildJobId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown GitHub deployment error.';
      failed.push({
        bindingId: binding.id,
        functionName: binding.functionName,
        error: message,
      });
      await postCommitStatusBestEffort(binding.installationId, binding.owner, binding.repo, commitSha, {
        state: 'error',
        description: 'Lecrev failed to enqueue the deployment',
        context: statusContext,
      });
    }
  }

  return {
    repository: repoFullName,
    ref: branch,
    matchedBindings: bindings.length,
    accepted,
    failed,
  };
}

function shouldHandlePullRequestAction(action: string): boolean {
  switch (action) {
    case 'opened':
    case 'reopened':
    case 'synchronize':
    case 'ready_for_review':
      return true;
    default:
      return false;
  }
}

async function handlePullRequestWebhook(payload: GitHubPullRequestPayload): Promise<{
  repository: string;
  ref: string;
  matchedBindings: number;
  accepted: Array<{ bindingId: string; functionName: string; functionVersionId: string; buildJobId?: string }>;
  failed: Array<{ bindingId: string; functionName: string; error: string }>;
}> {
  const action = `${payload.action ?? ''}`.trim();
  if (!shouldHandlePullRequestAction(action)) {
    return {
      repository: payload.repository?.full_name ?? '',
      ref: normalizeBranchRef(payload.pull_request?.base?.ref),
      matchedBindings: 0,
      accepted: [],
      failed: [],
    };
  }

  const baseRepo = payload.pull_request?.base?.repo;
  const headRepo = payload.pull_request?.head?.repo;
  const installationId = Number(payload.installation?.id ?? 0);
  const owner = baseRepo?.owner?.login ?? payload.repository?.owner?.login ?? '';
  const repo = baseRepo?.name ?? payload.repository?.name ?? '';
  const repoFullName = baseRepo?.full_name ?? payload.repository?.full_name ?? `${owner}/${repo}`;
  const baseRef = normalizeBranchRef(payload.pull_request?.base?.ref);
  const headRef = normalizeBranchRef(payload.pull_request?.head?.ref);
  const commitSha = `${payload.pull_request?.head?.sha ?? ''}`.trim();
  const prNumber = Number(payload.number ?? 0);

  if (!installationId || !owner || !repo || !baseRef || !headRef || !commitSha || !prNumber) {
    throw new Error('Pull request webhook payload is missing installation, repository, head ref, base ref, commit SHA, or PR number.');
  }

  const bindings = findBindingsForPreview(installationId, owner, repo, baseRef);
  const accepted: Array<{ bindingId: string; functionName: string; functionVersionId: string; buildJobId?: string }> = [];
  const failed: Array<{ bindingId: string; functionName: string; error: string }> = [];

  const previewOwner = headRepo?.owner?.login ?? owner;
  const previewRepo = headRepo?.name ?? repo;
  const previewRepoFullName = headRepo?.full_name ?? `${previewOwner}/${previewRepo}`;
  const previewGitURL = headRepo?.clone_url ?? canonicalGitURL(previewOwner, previewRepo);
  const headRepoIsDifferent = previewRepoFullName.toLowerCase() !== repoFullName.toLowerCase();
  let previewInstallationId = await resolveRepositoryInstallationID(previewOwner, previewRepo);
  if (!previewInstallationId && !headRepoIsDifferent) {
    previewInstallationId = installationId;
  }

  for (const binding of bindings) {
    const functionName = previewFunctionName(binding.functionName, prNumber);
    const statusContext = statusContextForRun({ eventType: 'pull_request', environment: 'preview' });
    const marker = previewCommentMarker(binding.id, prNumber);
    try {
      if (!previewInstallationId) {
        throw new Error('GitHub App is not installed on the pull request head repository, so a preview deployment cannot be created.');
      }
      await postCommitStatusBestEffort(previewInstallationId, previewOwner, previewRepo, commitSha, {
        state: 'pending',
        description: 'Lecrev preview build queued',
        context: statusContext,
      });

      const run = await createDeploymentRun({
        binding,
        owner: previewOwner,
        repo: previewRepo,
        repoFullName: previewRepoFullName,
        gitUrl: previewGitURL,
        gitRef: headRef,
        installationId: previewInstallationId,
        commitSha,
        eventType: 'pull_request',
        environment: 'preview',
        functionName,
        prNumber,
      });

      await upsertPreviewCommentBestEffort({
        installationId: previewInstallationId,
        owner: previewOwner,
        repo: previewRepo,
        prNumber,
        marker,
        body: buildPreviewCommentBody({
          marker,
          owner: previewOwner,
          repo: previewRepo,
          gitRef: headRef,
          commitSha,
          state: 'pending',
          functionName,
          message: 'Preview build queued.',
          buildURL: buildTargetURL(run.buildJobId, run.functionVersionId),
        }),
      });

      accepted.push({
        bindingId: run.bindingId,
        functionName,
        functionVersionId: run.functionVersionId,
        buildJobId: run.buildJobId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown GitHub preview deployment error.';
      failed.push({
        bindingId: binding.id,
        functionName,
        error: message,
      });
      await postCommitStatusBestEffort(previewInstallationId, previewOwner, previewRepo, commitSha, {
        state: 'error',
        description: 'Lecrev failed to enqueue the preview build',
        context: statusContext,
      });
      await upsertPreviewCommentBestEffort({
        installationId: previewInstallationId,
        owner: previewOwner,
        repo: previewRepo,
        prNumber,
        marker,
        body: buildPreviewCommentBody({
          marker,
          owner: previewOwner,
          repo: previewRepo,
          gitRef: headRef,
          commitSha,
          state: 'error',
          functionName,
          message,
        }),
      });
    }
  }

  return {
    repository: repoFullName,
    ref: baseRef,
    matchedBindings: bindings.length,
    accepted,
    failed,
  };
}

async function pollPendingRuns(): Promise<void> {
  const pendingRuns = listPendingGitHubDeploymentRuns();
  for (const run of pendingRuns) {
    try {
      const binding = listGitHubRepoBindingsByUser(run.userId).find((entry) => entry.id === run.bindingId);
      const runFunctionName = run.eventType === 'pull_request' && run.prNumber
        ? previewFunctionName(binding?.functionName ?? run.repo, run.prNumber)
        : binding?.functionName ?? run.repo;
      const connection = connectionForUser(run.userId);
      const [version, buildJob] = await Promise.all([
        getFunctionVersion(connection, run.functionVersionId),
        run.buildJobId ? getBuildJob(connection, run.buildJobId) : Promise.resolve(undefined),
      ]);
      const fallbackTargetURL = buildTargetURL(run.buildJobId, run.functionVersionId);

      if ((buildJob && buildJob.state === 'failed') || version.state === 'failed') {
        const description = buildJob?.error || 'Lecrev build failed';
        await postCommitStatusBestEffort(run.installationId, run.owner, run.repo, run.commitSha, {
          state: 'failure',
          description,
          targetUrl: fallbackTargetURL,
          context: run.statusContext,
        });
        if (run.eventType === 'pull_request' && run.prNumber) {
          const marker = previewCommentMarker(run.bindingId, run.prNumber);
          await upsertPreviewCommentBestEffort({
            installationId: run.installationId,
            owner: run.owner,
            repo: run.repo,
            prNumber: run.prNumber,
            marker,
            body: buildPreviewCommentBody({
              marker,
              owner: run.owner,
              repo: run.repo,
              gitRef: run.gitRef,
              commitSha: run.commitSha,
              state: 'failure',
              functionName: runFunctionName,
              message: description,
              buildURL: fallbackTargetURL,
            }),
          });
        }
        markGitHubDeploymentRunState(run.id, 'failed', description);
        continue;
      }

      if ((buildJob && buildJob.state === 'succeeded' && version.state === 'ready') || (!buildJob && version.state === 'ready')) {
        let previewURL: string | undefined;
        try {
          const urls = await listFunctionURLs(connection, run.functionVersionId);
          previewURL = urls[0]?.url;
        } catch {
          previewURL = undefined;
        }

        await postCommitStatusBestEffort(run.installationId, run.owner, run.repo, run.commitSha, {
          state: 'success',
          description: run.environment === 'preview' ? 'Lecrev preview is ready' : 'Lecrev deployment is ready',
          targetUrl: previewURL || fallbackTargetURL,
          context: run.statusContext,
        });
        if (run.eventType === 'pull_request' && run.prNumber) {
          const marker = previewCommentMarker(run.bindingId, run.prNumber);
          await upsertPreviewCommentBestEffort({
            installationId: run.installationId,
            owner: run.owner,
            repo: run.repo,
            prNumber: run.prNumber,
            marker,
            body: buildPreviewCommentBody({
              marker,
              owner: run.owner,
              repo: run.repo,
              gitRef: run.gitRef,
              commitSha: run.commitSha,
              state: 'success',
              functionName: runFunctionName,
              message: 'Preview deployment ready.',
              previewURL,
              buildURL: fallbackTargetURL,
            }),
          });
        }
        markGitHubDeploymentRunState(run.id, 'succeeded');
      }
    } catch (error) {
      console.error('[github-automation] run polling failed', run.id, error);
    }
  }
}

export function startGitHubDeploymentMonitor(): void {
  if (!isGitHubAppReady) {
    return;
  }
  void pollPendingRuns();
  setInterval(() => {
    void pollPendingRuns();
  }, 5000);
}

export function createGitHubDeploymentRouter() {
  const router = express.Router();

  router.post('/webhooks', express.raw({ type: '*/*' }), async (req, res) => {
    if (!githubWebhookSecret) {
      res.status(503).json({ error: 'GitHub webhook secret is not configured.' });
      return;
    }

    const signature = req.header('x-hub-signature-256') ?? undefined;
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
    if (!verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    const event = req.header('x-github-event') ?? '';
    if (event === 'ping') {
      res.json({ ok: true });
      return;
    }

    try {
      if (event === 'push') {
        const payload = JSON.parse(rawBody.toString('utf8')) as GitHubPushPayload;
        const result = await handlePushWebhook(payload);
        res.status(202).json({
          ok: true,
          event,
          ...result,
        });
        return;
      }

      if (event === 'pull_request') {
        const payload = JSON.parse(rawBody.toString('utf8')) as GitHubPullRequestPayload;
        const result = await handlePullRequestWebhook(payload);
        res.status(202).json({
          ok: true,
          event,
          ...result,
        });
        return;
      }

      res.status(202).json({ ok: true, ignored: event || 'unknown' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GitHub webhook processing failed.';
      res.status(400).json({ error: message });
    }
  });

  router.use(express.json());

  router.get('/deployments/bindings', async (req, res) => {
    const user = await getAuthenticatedSessionUser(req);
    if (!user?.id) {
      res.status(401).json({ error: 'Sign in to view GitHub deployment bindings.' });
      return;
    }
    res.json(listGitHubRepoBindingsByUser(user.id));
  });

  router.post('/deployments/bindings', async (req, res) => {
    const user = await getAuthenticatedSessionUser(req);
    if (!user?.id) {
      res.status(401).json({ error: 'Sign in to manage GitHub deployment bindings.' });
      return;
    }

    const body = req.body as Partial<{
      installationId: number;
      owner: string;
      repo: string;
      repoFullName: string;
      gitUrl: string;
      gitRef: string;
      entrypoint: string;
      projectId: string;
      functionName: string;
      environment: 'production' | 'staging' | 'preview';
      region: string;
      autoDeploy: boolean;
      deployNow: boolean;
      lastFunctionVersionId?: string;
      lastBuildJobId?: string;
      lastCommitSha?: string;
    }>;

    if (!body.installationId || !body.owner || !body.repo || !body.gitRef || !body.entrypoint || !body.functionName) {
      res.status(400).json({ error: 'installationId, owner, repo, gitRef, entrypoint, and functionName are required.' });
      return;
    }

    try {
      const authorized = await loadAuthorizedRepository(req, body.owner, body.repo);
      if (!authorized) {
        res.status(401).json({ error: 'Sign in with GitHub to access repository bindings.' });
        return;
      }
      if (authorized.installationId !== body.installationId) {
        res.status(403).json({ error: 'The selected installation does not match the signed-in user’s repository access.' });
        return;
      }

      const userConnection = getGitHubUserConnection(user.id);
      if (!userConnection) {
        res.status(409).json({ error: 'Lecrev session connection is not ready yet. Refresh the page and try again.' });
        return;
      }
      const connection: LecrevServerConnection = {
        apiKey: userConnection.apiKey,
        projectId: userConnection.projectId,
      };
      const projectId = body.projectId?.trim() || connection.projectId?.trim();
      if (!projectId) {
        res.status(400).json({ error: 'Select a project before creating a GitHub deployment binding.' });
        return;
      }
      await validateProjectAccess(connection, projectId);

      const functionName = sanitizeFunctionName(body.functionName);
      const environment = body.environment ?? 'production';
      const region = body.region?.trim() || 'ap-south-1';
      const binding = upsertGitHubRepoBinding({
        userId: user.id,
        tenantId: userConnection.tenantId,
        installationId: authorized.installationId,
        owner: authorized.repository.owner,
        repo: authorized.repository.repo,
        repoFullName: authorized.repository.fullName,
        gitUrl: authorized.repository.gitUrl ?? body.gitUrl ?? canonicalGitURL(authorized.repository.owner, authorized.repository.repo),
        gitRef: body.gitRef,
        entrypoint: body.entrypoint,
        projectId,
        functionName,
        environment,
        region,
        autoDeploy: body.autoDeploy !== false,
        lastFunctionVersionId: body.lastFunctionVersionId,
        lastBuildJobId: body.lastBuildJobId,
        lastCommitSha: body.lastCommitSha,
      });

      if (body.deployNow) {
        const commitSha = body.lastCommitSha?.trim() || await resolveCommitSHA(
          authorized.installationId,
          authorized.repository.owner,
          authorized.repository.repo,
          body.gitRef,
        );
        const statusContext = statusContextForRun({ eventType: 'push', environment });
        await postCommitStatusBestEffort(binding.installationId, binding.owner, binding.repo, commitSha, {
          state: 'pending',
          description: `Lecrev ${environment} deployment queued`,
          context: statusContext,
        });

        const run = await createDeploymentRun({
          binding,
          owner: binding.owner,
          repo: binding.repo,
          repoFullName: binding.repoFullName,
          gitUrl: binding.gitUrl,
          gitRef: binding.gitRef,
          installationId: binding.installationId,
          commitSha,
          eventType: 'push',
          environment,
          functionName: binding.functionName,
        });

        res.status(201).json({
          binding,
          deployment: {
            functionVersionId: run.functionVersionId,
            buildJobId: run.buildJobId,
          },
        });
        return;
      }

      res.status(201).json({ binding });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register GitHub deployment binding.';
      res.status(502).json({ error: message });
    }
  });

  return router;
}
