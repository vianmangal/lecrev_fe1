import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const githubAppID = (process.env.GITHUB_APP_ID ?? '').trim();
const githubPrivateKeyPath = (process.env.GITHUB_PRIVATE_KEY_PATH ?? '').trim();

export const isGithubAppConfigured = Boolean(githubAppID && githubPrivateKeyPath);

function base64URL(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createAppJWT(): string {
  if (!isGithubAppConfigured) {
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
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'lecrev-frontend-auth',
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

async function getAppMetadata(): Promise<{ name?: string; slug?: string }> {
  return githubRequest('/app', {}, createAppJWT());
}

async function resolveInstallationID(owner: string, repo: string): Promise<number> {
  const appJWT = createAppJWT();
  const payload = await githubRequest<{ id: number }>(`/repos/${owner}/${repo}/installation`, {}, appJWT);
  return payload.id;
}

async function createInstallationToken(installationID: number): Promise<string> {
  const appJWT = createAppJWT();
  const payload = await githubRequest<{ token: string }>(
    `/app/installations/${installationID}/access_tokens`,
    { method: 'POST' },
    appJWT,
  );
  return payload.token;
}

async function withInstallationToken<T>(owner: string, repo: string, fn: (token: string) => Promise<T>): Promise<T> {
  const installationID = await resolveInstallationID(owner, repo);
  const installationToken = await createInstallationToken(installationID);
  return fn(installationToken);
}

function sendGitHubError(res: express.Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'GitHub request failed.';
  const lower = message.toLowerCase();
  if (lower.includes('installation') || lower.includes('not found') || lower.includes('"message":"not found"')) {
    res.status(404).json({ error: 'GitHub App is not installed on this repository or the repository could not be found.' });
    return;
  }
  res.status(502).json({ error: message });
}

export function createGitHubAppRouter() {
  const router = express.Router();

  router.get('/app', async (_req, res) => {
    if (!isGithubAppConfigured) {
      res.json({ configured: false });
      return;
    }
    try {
      const metadata = await getAppMetadata();
      res.json({
        configured: true,
        appId: githubAppID,
        name: metadata.name,
        slug: metadata.slug,
        installUrl: metadata.slug ? `https://github.com/apps/${metadata.slug}/installations/new` : undefined,
      });
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos/:owner/:repo', async (req, res) => {
    try {
      const payload = await withInstallationToken(req.params.owner, req.params.repo, async (token) => (
        githubRequest(`/repos/${req.params.owner}/${req.params.repo}`, {}, token)
      ));
      res.json(payload);
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos/:owner/:repo/git/trees/:ref', async (req, res) => {
    try {
      const recursiveQuery = req.query.recursive ? '?recursive=1' : '';
      const payload = await withInstallationToken(req.params.owner, req.params.repo, async (token) => (
        githubRequest(`/repos/${req.params.owner}/${req.params.repo}/git/trees/${encodeURIComponent(req.params.ref)}${recursiveQuery}`, {}, token)
      ));
      res.json(payload);
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos/:owner/:repo/contents', async (req, res) => {
    const filePath = `${req.query.path ?? ''}`.trim();
    if (!filePath) {
      res.status(400).json({ error: 'Query parameter "path" is required.' });
      return;
    }

    try {
      const ref = `${req.query.ref ?? ''}`.trim();
      const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const payload = await withInstallationToken(req.params.owner, req.params.repo, async (token) => (
        githubRequest(`/repos/${req.params.owner}/${req.params.repo}/contents/${filePath}${suffix}`, {}, token)
      ));
      res.json(payload);
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  return router;
}
