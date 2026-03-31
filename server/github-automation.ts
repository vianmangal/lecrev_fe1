import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import {
  CreateGitFunctionVersionInput,
  createGitFunctionVersion,
  getBuildJob,
  getFunctionVersion,
  LecrevServerConnection,
} from './lecrev-api';
import {
  CreateGitHubDeploymentRunInput,
  createGitHubDeploymentRun,
  findBindingsForPush,
  getGitHubUserConnection,
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
const githubStatusContext = (process.env.GITHUB_STATUS_CONTEXT ?? 'lecrev/build').trim() || 'lecrev/build';

const isGitHubAppReady = Boolean(githubAppID && githubPrivateKeyPath);

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

async function triggerBindingDeploy(input: {
  binding: ReturnType<typeof findBindingsForPush>[number];
  commitSha: string;
}): Promise<CreateGitHubDeploymentRunInput> {
  const connection = connectionForUser(input.binding.userId);
  const deployInput: CreateGitFunctionVersionInput = {
    projectId: input.binding.projectId,
    name: input.binding.functionName,
    environment: input.binding.environment,
    region: input.binding.region,
    entrypoint: input.binding.entrypoint,
    gitUrl: input.binding.gitUrl,
    gitRef: input.binding.gitRef,
    idempotencyKey: `github-push-${input.binding.id}-${input.commitSha}`,
  };

  const version = await createGitFunctionVersion(connection, deployInput);
  const targetUrl = buildTargetURL(version.buildJobId, version.id);

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

  return {
    bindingId: input.binding.id,
    userId: input.binding.userId,
    tenantId: input.binding.tenantId,
    projectId: input.binding.projectId,
    installationId: input.binding.installationId,
    owner: input.binding.owner,
    repo: input.binding.repo,
    repoFullName: input.binding.repoFullName,
    gitRef: input.binding.gitRef,
    commitSha: input.commitSha,
    functionVersionId: version.id,
    buildJobId: version.buildJobId,
    statusContext: githubStatusContext,
    targetUrl,
  };
}

async function pollPendingRuns(): Promise<void> {
  const pendingRuns = listPendingGitHubDeploymentRuns();
  for (const run of pendingRuns) {
    try {
      const connection = connectionForUser(run.userId);
      const [version, buildJob] = await Promise.all([
        getFunctionVersion(connection, run.functionVersionId),
        run.buildJobId ? getBuildJob(connection, run.buildJobId) : Promise.resolve(undefined),
      ]);

      if ((buildJob && buildJob.state === 'failed') || version.state === 'failed') {
        await postCommitStatusBestEffort(run.installationId, run.owner, run.repo, run.commitSha, {
          state: 'failure',
          description: buildJob?.error || 'Lecrev build failed',
          targetUrl: buildTargetURL(run.buildJobId, run.functionVersionId),
          context: run.statusContext,
        });
        markGitHubDeploymentRunState(run.id, 'failed', buildJob?.error ?? 'Build failed');
        continue;
      }

      if ((buildJob && buildJob.state === 'succeeded' && version.state === 'ready') || (!buildJob && version.state === 'ready')) {
        await postCommitStatusBestEffort(run.installationId, run.owner, run.repo, run.commitSha, {
          state: 'success',
          description: 'Lecrev build is ready',
          targetUrl: buildTargetURL(run.buildJobId, run.functionVersionId),
          context: run.statusContext,
        });
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
    if (event !== 'push') {
      res.status(202).json({ ok: true, ignored: event || 'unknown' });
      return;
    }

    let payload: GitHubPushPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as GitHubPushPayload;
    } catch {
      res.status(400).json({ error: 'Invalid JSON payload.' });
      return;
    }

    const installationId = Number(payload.installation?.id ?? 0);
    const owner = payload.repository?.owner?.login ?? '';
    const repo = payload.repository?.name ?? '';
    const repoFullName = payload.repository?.full_name ?? '';
    const branch = normalizeBranchRef(payload.ref);
    const commitSha = `${payload.after ?? ''}`.trim();

    if (!installationId || !owner || !repo || !branch || !commitSha) {
      res.status(400).json({ error: 'Push webhook payload is missing installation, repository, ref, or commit SHA.' });
      return;
    }

    const bindings = findBindingsForPush(installationId, owner, repo, branch);
    if (bindings.length === 0) {
      res.status(202).json({ ok: true, matchedBindings: 0, repository: repoFullName, ref: branch });
      return;
    }

    const accepted: Array<{ bindingId: string; functionName: string; functionVersionId: string; buildJobId?: string }> = [];
    const failed: Array<{ bindingId: string; functionName: string; error: string }> = [];
    for (const binding of bindings) {
      try {
        await postCommitStatusBestEffort(binding.installationId, binding.owner, binding.repo, commitSha, {
          state: 'pending',
          description: 'Lecrev build queued',
          context: githubStatusContext,
        });

        const runInput = await triggerBindingDeploy({ binding, commitSha });
        const run = createGitHubDeploymentRun(runInput);
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
          description: 'Lecrev failed to enqueue the build',
          context: githubStatusContext,
        });
      }
    }

    res.status(202).json({
      ok: true,
      matchedBindings: bindings.length,
      repository: repoFullName,
      ref: branch,
      accepted,
      failed,
    });
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

      const connection = getGitHubUserConnection(user.id);
      if (!connection) {
        res.status(409).json({ error: 'Lecrev session connection is not ready yet. Refresh the page and try again.' });
        return;
      }

      const requestedProjectId = body.projectId?.trim();
      if (requestedProjectId && requestedProjectId !== connection.projectId) {
        res.status(403).json({ error: 'GitHub deployment bindings are restricted to the signed-in user’s tenant project.' });
        return;
      }

      const binding = upsertGitHubRepoBinding({
        userId: user.id,
        tenantId: connection.tenantId,
        installationId: authorized.installationId,
        owner: authorized.repository.owner,
        repo: authorized.repository.repo,
        repoFullName: authorized.repository.fullName,
        gitUrl: authorized.repository.gitUrl ?? body.gitUrl,
        gitRef: body.gitRef,
        entrypoint: body.entrypoint,
        projectId: connection.projectId,
        functionName: body.functionName,
        environment: body.environment ?? 'production',
        region: body.region?.trim() || 'ap-south-1',
        autoDeploy: body.autoDeploy !== false,
        lastFunctionVersionId: body.lastFunctionVersionId,
        lastBuildJobId: body.lastBuildJobId,
        lastCommitSha: body.lastCommitSha,
      });

      res.status(201).json(binding);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register GitHub deployment binding.';
      res.status(502).json({ error: message });
    }
  });

  return router;
}
