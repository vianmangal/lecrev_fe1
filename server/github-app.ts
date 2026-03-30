import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const githubAppID = (process.env.GITHUB_APP_ID ?? '').trim();
const githubPrivateKeyPath = (process.env.GITHUB_PRIVATE_KEY_PATH ?? '').trim();

export const isGithubAppConfigured = Boolean(githubAppID && githubPrivateKeyPath);

interface GitHubAppMetadataPayload {
  name?: string;
  slug?: string;
}

interface GitHubAccountPayload {
  login?: string;
  avatar_url?: string;
  type?: string;
}

interface GitHubInstallationPayload {
  id: number;
  target_type?: string;
  repository_selection?: string;
  account?: GitHubAccountPayload;
}

interface GitHubRepoPayload {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch?: string;
  html_url?: string;
  clone_url?: string;
  owner?: {
    login?: string;
  };
}

interface GitHubTreePayload {
  tree?: Array<{
    path: string;
    type: 'blob' | 'tree';
  }>;
}

interface GitHubInstallationsResponse {
  installations?: GitHubInstallationPayload[];
}

interface GitHubInstallationRepositoriesResponse {
  total_count?: number;
  repositories?: GitHubRepoPayload[];
}

interface GitHubPackageManifest {
  main?: string;
  module?: string;
  exports?: string | Record<string, unknown>;
}

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
      Accept: 'application/vnd.github+json',
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

async function getAppMetadata(): Promise<GitHubAppMetadataPayload> {
  return githubRequest('/app', {}, createAppJWT());
}

async function listInstallations(): Promise<GitHubInstallationPayload[]> {
  const payload = await githubRequest<GitHubInstallationsResponse | GitHubInstallationPayload[]>(
    '/app/installations?per_page=100',
    {},
    createAppJWT(),
  );
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload.installations ?? [];
}

async function resolveInstallationID(owner: string, repo: string): Promise<number> {
  const payload = await githubRequest<{ id: number }>(`/repos/${owner}/${repo}/installation`, {}, createAppJWT());
  return payload.id;
}

async function createInstallationToken(installationID: number): Promise<string> {
  const payload = await githubRequest<{ token: string }>(
    `/app/installations/${installationID}/access_tokens`,
    { method: 'POST' },
    createAppJWT(),
  );
  return payload.token;
}

async function withInstallationToken<T>(owner: string, repo: string, fn: (token: string, installationID: number) => Promise<T>): Promise<T> {
  const installationID = await resolveInstallationID(owner, repo);
  const installationToken = await createInstallationToken(installationID);
  return fn(installationToken, installationID);
}

async function withKnownInstallationToken<T>(installationID: number, fn: (token: string) => Promise<T>): Promise<T> {
  const installationToken = await createInstallationToken(installationID);
  return fn(installationToken);
}

async function listInstallationRepositories(installationID: number): Promise<GitHubInstallationRepositoriesResponse> {
  return withKnownInstallationToken(installationID, async (token) => {
    const repositories: GitHubRepoPayload[] = [];
    const perPage = 100;
    let totalCount = 0;

    for (let page = 1; page <= 100; page += 1) {
      const payload = await githubRequest<GitHubInstallationRepositoriesResponse>(
        `/installation/repositories?per_page=${perPage}&page=${page}`,
        {},
        token,
      );
      const nextPage = payload.repositories ?? [];
      totalCount = payload.total_count ?? totalCount;
      repositories.push(...nextPage);

      if (nextPage.length < perPage) {
        break;
      }
    }

    return {
      total_count: totalCount || repositories.length,
      repositories,
    };
  });
}

function sendGitHubError(res: express.Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'GitHub request failed.';
  const lower = message.toLowerCase();
  if (lower.includes('installation') || lower.includes('not found') || lower.includes('"message":"not found"')) {
    res.status(404).json({ error: 'GitHub App is not installed on this repository or the repository could not be found.' });
    return;
  }
  if (lower.includes('rate limit')) {
    res.status(429).json({ error: message });
    return;
  }
  res.status(502).json({ error: message });
}

function normalizeInstallation(payload: GitHubInstallationPayload) {
  return {
    id: payload.id,
    accountLogin: payload.account?.login ?? `installation-${payload.id}`,
    accountType: payload.account?.type ?? payload.target_type ?? 'Unknown',
    avatarUrl: payload.account?.avatar_url,
    repositorySelection: payload.repository_selection ?? 'selected',
  };
}

function normalizeRepository(payload: GitHubRepoPayload, installationID?: number) {
  return {
    id: payload.id,
    installationId: installationID,
    owner: payload.owner?.login ?? payload.full_name.split('/')[0] ?? '',
    repo: payload.name,
    fullName: payload.full_name,
    defaultBranch: payload.default_branch ?? 'main',
    private: payload.private,
    htmlUrl: payload.html_url,
    gitUrl: payload.clone_url ?? (payload.full_name ? `https://github.com/${payload.full_name}.git` : undefined),
  };
}

function parsePositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(`${value ?? ''}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function coercePackageEntry(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().replace(/^\.\//, '');
  }
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  return coercePackageEntry(value.import)
    ?? coercePackageEntry(value.require)
    ?? coercePackageEntry(value.default)
    ?? coercePackageEntry(value['.']);
}

function scoreEntrypoint(path: string): number {
  const lower = path.toLowerCase();
  let score = 0;

  if (/(^|\/)(next|vite|vitest|jest|eslint|tailwind|postcss|babel|webpack|rollup|metro)\.config\./.test(lower)) return -200;
  if (/(^|\/)(layout|page|loading|error|not-found)\.(jsx?|tsx?)$/.test(lower)) return -150;
  if (/(^|\/)(components|fixtures|examples|docs|scripts|migrations)\//.test(lower)) return -120;
  if (/^dist\//.test(lower) || /^build\//.test(lower)) score += 50;
  if (/^app\/api\/.+\/route\.(mjs|js|cjs|ts|tsx)$/.test(lower)) score += 80;
  if (/^(api|functions|handlers?|server|workers?)\//.test(lower)) score += 60;
  if (/(^|\/)(server|handler|index|main)\.(mjs|js|cjs)$/.test(lower)) score += 40;
  if (/(^|\/)(server|handler|index|main)\.(ts|tsx)$/.test(lower)) score += 15;
  if (/\.(mjs|js|cjs)$/.test(lower)) score += 25;
  if (/\.(ts|tsx)$/.test(lower)) score += 10;
  if (/^src\//.test(lower)) score -= 5;
  if (/test|spec|__tests__|fixtures|examples/.test(lower)) score -= 100;

  return score;
}

function isExplicitEntrypointCandidate(path: string): boolean {
  const lower = path.toLowerCase();
  if (!/\.(js|mjs|cjs|ts|tsx)$/.test(lower)) return false;
  if (/(^|\/)(next|vite|vitest|jest|eslint|tailwind|postcss|babel|webpack|rollup|metro)\.config\./.test(lower)) return false;
  if (/(^|\/)(layout|page|loading|error|not-found)\.(jsx?|tsx?)$/.test(lower)) return false;
  if (/^app\/api\/.+\/route\.(mjs|js|cjs|ts|tsx)$/.test(lower)) return true;
  if (/^(api|functions|handlers?|server|workers?)\//.test(lower)) return true;
  if (/^(dist|build)\//.test(lower) && /\.(mjs|js|cjs)$/.test(lower)) return true;
  if (/(^|\/)(server|handler|index|main|route)\.(mjs|js|cjs|ts|tsx)$/.test(lower)) return true;
  return false;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function deriveEntrypointCandidates(tree: GitHubTreePayload['tree'], packageManifest?: GitHubPackageManifest | null): string[] {
  const files = (tree ?? [])
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .filter((path) => /\.(js|mjs|cjs|ts|tsx)$/.test(path));

  const explicitCandidates = uniqueStrings([
    coercePackageEntry(packageManifest?.main),
    coercePackageEntry(packageManifest?.module),
    coercePackageEntry(packageManifest?.exports),
  ]);

  const scored = files
    .map((path) => ({ path, score: scoreEntrypoint(path) }))
    .filter((entry) => entry.score > -100 && (explicitCandidates.includes(entry.path) || isExplicitEntrypointCandidate(entry.path)))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.path.localeCompare(right.path);
    })
    .map((entry) => entry.path);

  return uniqueStrings([...explicitCandidates, ...scored]).slice(0, 12);
}

async function maybeReadPackageManifest(owner: string, repo: string, ref: string, token: string): Promise<GitHubPackageManifest | null> {
  try {
    const payload = await githubRequest<{ content?: string }>(
      `/repos/${owner}/${repo}/contents/package.json?ref=${encodeURIComponent(ref)}`,
      {},
      token,
    );
    if (!payload.content) {
      return null;
    }
    const decoded = Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8');
    return JSON.parse(decoded) as GitHubPackageManifest;
  } catch {
    return null;
  }
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

  router.get('/installations', async (_req, res) => {
    if (!isGithubAppConfigured) {
      res.json({ configured: false, installations: [] });
      return;
    }
    try {
      const installations = await listInstallations();
      res.json({
        configured: true,
        installations: installations.map(normalizeInstallation),
      });
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos', async (req, res) => {
    const installationID = parsePositiveInt(req.query.installationId, 0, Number.MAX_SAFE_INTEGER);
    if (installationID <= 0) {
      res.status(400).json({ error: 'Query parameter "installationId" is required.' });
      return;
    }

    const pageParam = `${req.query.page ?? ''}`.trim();
    const page = parsePositiveInt(pageParam, 1, 1000);
    const perPage = parsePositiveInt(req.query.perPage, 100, 100);
    const query = `${req.query.q ?? ''}`.trim().toLowerCase();

    try {
      if (!pageParam) {
        const payload = await listInstallationRepositories(installationID);
        const repositories = (payload.repositories ?? [])
          .map((repo) => normalizeRepository(repo, installationID))
          .filter((repo) => {
            if (!query) {
              return true;
            }
            return repo.fullName.toLowerCase().includes(query);
          });

        res.json({
          installationId: installationID,
          page: 1,
          perPage: repositories.length,
          totalCount: payload.total_count ?? repositories.length,
          hasNextPage: false,
          repositories,
        });
        return;
      }

      const payload = await withKnownInstallationToken(installationID, async (token) => (
        githubRequest<GitHubInstallationRepositoriesResponse>(
          `/installation/repositories?per_page=${perPage}&page=${page}`,
          {},
          token,
        )
      ));

      const repositories = (payload.repositories ?? [])
        .map((repo) => normalizeRepository(repo, installationID))
        .filter((repo) => {
          if (!query) {
            return true;
          }
          return repo.fullName.toLowerCase().includes(query);
        });

      res.json({
        installationId: installationID,
        page,
        perPage,
        totalCount: payload.total_count ?? repositories.length,
        hasNextPage: (payload.repositories?.length ?? 0) === perPage,
        repositories,
      });
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos/:owner/:repo', async (req, res) => {
    try {
      const payload = await withInstallationToken(req.params.owner, req.params.repo, async (token, installationID) => (
        normalizeRepository(
          await githubRequest<GitHubRepoPayload>(`/repos/${req.params.owner}/${req.params.repo}`, {}, token),
          installationID,
        )
      ));
      res.json(payload);
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos/:owner/:repo/inspect', async (req, res) => {
    const requestedRef = `${req.query.ref ?? ''}`.trim();

    try {
      const payload = await withInstallationToken(req.params.owner, req.params.repo, async (token, installationID) => {
        const repo = normalizeRepository(
          await githubRequest<GitHubRepoPayload>(`/repos/${req.params.owner}/${req.params.repo}`, {}, token),
          installationID,
        );
        const ref = requestedRef || repo.defaultBranch || 'main';
        const tree = await githubRequest<GitHubTreePayload>(
          `/repos/${req.params.owner}/${req.params.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
          {},
          token,
        );
        const packageManifest = await maybeReadPackageManifest(req.params.owner, req.params.repo, ref, token);
        const entrypointCandidates = deriveEntrypointCandidates(tree.tree, packageManifest);

        return {
          repository: repo,
          ref,
          entrypointCandidates,
          suggestedEntrypoint: entrypointCandidates[0] ?? '',
          suggestedFunctionName: repo.repo.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase(),
        };
      });
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
