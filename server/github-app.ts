import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import {
  getAuthenticatedGitHubAccessToken,
  getAuthenticatedSessionUser,
} from './auth-session';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const githubAppID = (process.env.GITHUB_APP_ID ?? '').trim();
const githubPrivateKeyPath = (process.env.GITHUB_PRIVATE_KEY_PATH ?? '').trim();

export const isGithubAppConfigured = Boolean(githubAppID && githubPrivateKeyPath);

interface GitHubAppMetadataPayload {
  name?: string;
  slug?: string;
}

interface GitHubAccountPayload {
  id?: number;
  login?: string;
  avatar_url?: string;
  type?: string;
}

export interface GitHubViewerPayload {
  id?: number;
  login?: string;
}

interface GitHubOrgPayload {
  login?: string;
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
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface GitHubWorkspaceInspection {
  subPath: string;
  packageManifest: GitHubPackageManifest | null;
  tree: GitHubTreePayload['tree'];
  framework?: string;
  deliveryKind: 'function' | 'website';
}

class GitHubAPIError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `GitHub API request failed with ${status}`);
    this.name = 'GitHubAPIError';
    this.status = status;
    this.body = body;
  }
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
    throw new GitHubAPIError(response.status, raw || `GitHub API request failed with ${response.status}`);
  }
  return raw ? JSON.parse(raw) as T : (undefined as T);
}

async function getAppMetadata(): Promise<GitHubAppMetadataPayload> {
  return githubRequest('/app', {}, createAppJWT());
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

async function withKnownInstallationToken<T>(installationID: number, fn: (token: string) => Promise<T>): Promise<T> {
  const installationToken = await createInstallationToken(installationID);
  return fn(installationToken);
}

async function listAppInstallations(): Promise<GitHubInstallationPayload[]> {
  const installations: GitHubInstallationPayload[] = [];
  const perPage = 100;
  for (let page = 1; page <= 100; page += 1) {
    const payload = await githubRequest<GitHubInstallationsResponse | GitHubInstallationPayload[]>(
      `/app/installations?per_page=${perPage}&page=${page}`,
      {},
      createAppJWT(),
    );
    const nextPage = Array.isArray(payload) ? payload : (payload.installations ?? []);
    installations.push(...nextPage);
    if (nextPage.length < perPage) {
      break;
    }
  }
  return installations;
}

async function listInstallationRepositories(installationID: number): Promise<GitHubInstallationRepositoriesResponse> {
  const repositories: GitHubRepoPayload[] = [];
  const perPage = 100;
  let totalCount = 0;
  const installationToken = await createInstallationToken(installationID);

  for (let page = 1; page <= 100; page += 1) {
    const payload = await githubRequest<GitHubInstallationRepositoriesResponse>(
      `/installation/repositories?per_page=${perPage}&page=${page}`,
      {},
      installationToken,
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
}

export async function getGitHubViewer(accessToken: string): Promise<GitHubViewerPayload> {
  return githubRequest<GitHubViewerPayload>('/user', {}, accessToken);
}

async function listViewerOrganizations(accessToken: string): Promise<GitHubOrgPayload[]> {
  const organizations: GitHubOrgPayload[] = [];
  const perPage = 100;
  for (let page = 1; page <= 100; page += 1) {
    const payload = await githubRequest<GitHubOrgPayload[]>(
      `/user/orgs?per_page=${perPage}&page=${page}`,
      {},
      accessToken,
    );
    organizations.push(...payload);
    if (payload.length < perPage) {
      break;
    }
  }
  return organizations;
}

async function listAccessibleInstallations(accessToken: string): Promise<GitHubInstallationPayload[]> {
  const [viewer, orgs, installations] = await Promise.all([
    getGitHubViewer(accessToken),
    listViewerOrganizations(accessToken).catch(() => [] as GitHubOrgPayload[]),
    listAppInstallations(),
  ]);

  const allowedAccountLogins = new Set<string>();
  if (viewer.login) {
    allowedAccountLogins.add(viewer.login.toLowerCase());
  }
  for (const organization of orgs) {
    if (organization.login) {
      allowedAccountLogins.add(organization.login.toLowerCase());
    }
  }

  return installations.filter((installation) => {
    const login = installation.account?.login?.toLowerCase();
    return Boolean(login && allowedAccountLogins.has(login));
  });
}

function sendGitHubError(res: express.Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'GitHub request failed.';
  if (error instanceof GitHubAPIError) {
    switch (error.status) {
      case 401:
        res.status(401).json({ error: 'Your GitHub session is not authorized. Sign in again.' });
        return;
      case 403:
        res.status(403).json({ error: 'Your GitHub session does not have access to this installation or repository. Sign in again after granting the requested scopes.' });
        return;
      case 404:
        res.status(404).json({ error: 'GitHub App is not installed on this repository or the repository could not be found.' });
        return;
      case 429:
        res.status(429).json({ error: message });
        return;
      default:
        break;
    }
  }
  const lower = message.toLowerCase();
  if (lower.includes('not found') || lower.includes('"message":"not found"')) {
    res.status(404).json({ error: 'GitHub App is not installed on this repository or the repository could not be found.' });
    return;
  }
  if (lower.includes('forbidden') || lower.includes('resource not accessible')) {
    res.status(403).json({ error: 'Your GitHub session does not have access to this installation or repository. Sign in again after granting the requested scopes.' });
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

function isNextWorkspace(packageManifest?: GitHubPackageManifest | null): boolean {
  if (!packageManifest) {
    return false;
  }
  for (const deps of [packageManifest.dependencies, packageManifest.devDependencies]) {
    if (deps && typeof deps === 'object' && 'next' in deps) {
      return true;
    }
  }
  return false;
}

function hasNextWebsiteSurface(tree: GitHubTreePayload['tree']): boolean {
  return (tree ?? []).some((entry) => {
    if (entry.type !== 'blob') {
      return false;
    }
    return /(^|\/)(app\/page|src\/app\/page|pages\/index)\.(jsx?|tsx?)$/.test(entry.path);
  });
}

function workspaceTree(tree: GitHubTreePayload['tree'], subPath: string): GitHubTreePayload['tree'] {
  const normalized = subPath.replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return tree;
  }
  const prefix = `${normalized}/`;
  return (tree ?? [])
    .filter((entry) => entry.path === normalized || entry.path.startsWith(prefix))
    .map((entry) => ({
      ...entry,
      path: entry.path === normalized ? '' : entry.path.slice(prefix.length),
    }))
    .filter((entry) => entry.path !== '');
}

function packageManifestPaths(tree: GitHubTreePayload['tree']): string[] {
  return uniqueStrings(
    (tree ?? [])
      .filter((entry) => entry.type === 'blob' && /(^|\/)package\.json$/.test(entry.path))
      .map((entry) => entry.path),
  ).sort((left, right) => {
    const leftDepth = left.split('/').length;
    const rightDepth = right.split('/').length;
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }
    return left.localeCompare(right);
  });
}

async function maybeReadPackageManifest(owner: string, repo: string, ref: string, token: string, packagePath = 'package.json'): Promise<GitHubPackageManifest | null> {
  try {
    const payload = await githubRequest<{ content?: string }>(
      `/repos/${owner}/${repo}/contents/${packagePath}?ref=${encodeURIComponent(ref)}`,
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

async function inspectRepositoryWorkspace(
  owner: string,
  repo: string,
  ref: string,
  token: string,
  tree: GitHubTreePayload['tree'],
): Promise<GitHubWorkspaceInspection> {
  const manifestPaths = packageManifestPaths(tree);
  let fallbackManifest: GitHubPackageManifest | null = await maybeReadPackageManifest(owner, repo, ref, token);

  for (const manifestPath of manifestPaths) {
    const subPath = manifestPath === 'package.json' ? '' : manifestPath.replace(/\/package\.json$/, '');
    const manifest = manifestPath === 'package.json'
      ? fallbackManifest
      : await maybeReadPackageManifest(owner, repo, ref, token, manifestPath);
    const scopedTree = workspaceTree(tree, subPath);
    if (isNextWorkspace(manifest) && hasNextWebsiteSurface(scopedTree)) {
      return {
        subPath,
        packageManifest: manifest,
        tree: scopedTree,
        framework: 'nextjs',
        deliveryKind: 'website',
      };
    }
    if (!subPath) {
      fallbackManifest = manifest;
    }
  }

  return {
    subPath: '',
    packageManifest: fallbackManifest,
    tree,
    deliveryKind: 'function',
  };
}

async function resolveAuthorizedGitHubContext(req: express.Request) {
  const [sessionUser, tokenPayload] = await Promise.all([
    getAuthenticatedSessionUser(req),
    getAuthenticatedGitHubAccessToken(req),
  ]);

  if (!sessionUser?.id || !tokenPayload?.accessToken) {
    return null;
  }

  return {
    user: sessionUser,
    accessToken: tokenPayload.accessToken,
    scopes: tokenPayload.scopes,
  };
}

export async function loadAuthorizedRepository(req: express.Request, owner: string, repo: string) {
  const context = await resolveAuthorizedGitHubContext(req);
  if (!context) {
    return null;
  }

  const installationId = await resolveInstallationID(owner, repo);
  const installations = await listAccessibleInstallations(context.accessToken);
  if (!installations.some((installation) => installation.id === installationId)) {
    const error = new Error('resource not accessible by integration');
    throw error;
  }

  const repositoriesPayload = await listInstallationRepositories(installationId);
  const repository = (repositoriesPayload.repositories ?? [])
    .map((entry) => normalizeRepository(entry, installationId))
    .find((entry) => entry.fullName.toLowerCase() === `${owner}/${repo}`.toLowerCase());

  if (!repository) {
    const error = new Error('resource not accessible by integration');
    throw error;
  }

  return {
    context,
    installationId,
    repository,
  };
}

function sendUnauthorized(res: express.Response) {
  res.status(401).json({ error: 'Sign in with GitHub to access repository installations.' });
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

  router.get('/installations', async (req, res) => {
    if (!isGithubAppConfigured) {
      res.json({ configured: false, installations: [] });
      return;
    }

    const context = await resolveAuthorizedGitHubContext(req);
    if (!context) {
      sendUnauthorized(res);
      return;
    }

    try {
      const installations = await listAccessibleInstallations(context.accessToken);
      res.json({
        configured: true,
        userId: context.user.id,
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

    const context = await resolveAuthorizedGitHubContext(req);
    if (!context) {
      sendUnauthorized(res);
      return;
    }

    const pageParam = `${req.query.page ?? ''}`.trim();
    const page = parsePositiveInt(pageParam, 1, 1000);
    const perPage = parsePositiveInt(req.query.perPage, 100, 100);
    const query = `${req.query.q ?? ''}`.trim().toLowerCase();

    try {
      const installations = await listAccessibleInstallations(context.accessToken);
      if (!installations.some((installation) => installation.id === installationID)) {
        res.status(403).json({ error: 'This installation is not accessible to the signed-in user.' });
        return;
      }

      const payload = await listInstallationRepositories(installationID);
      const filtered = (payload.repositories ?? [])
        .map((repo) => normalizeRepository(repo, installationID))
        .filter((repo) => {
          if (!query) {
            return true;
          }
          return repo.fullName.toLowerCase().includes(query);
        });

      if (!pageParam) {
        res.json({
          installationId: installationID,
          page: 1,
          perPage: filtered.length,
          totalCount: filtered.length,
          hasNextPage: false,
          repositories: filtered,
        });
        return;
      }

      const start = (page - 1) * perPage;
      const end = start + perPage;
      res.json({
        installationId: installationID,
        page,
        perPage,
        totalCount: filtered.length,
        hasNextPage: end < filtered.length,
        repositories: filtered.slice(start, end),
      });
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos/:owner/:repo', async (req, res) => {
    try {
      const authorized = await loadAuthorizedRepository(req, req.params.owner, req.params.repo);
      if (!authorized) {
        sendUnauthorized(res);
        return;
      }
      res.json(authorized.repository);
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos/:owner/:repo/inspect', async (req, res) => {
    const requestedRef = `${req.query.ref ?? ''}`.trim();

    try {
      const authorized = await loadAuthorizedRepository(req, req.params.owner, req.params.repo);
      if (!authorized) {
        sendUnauthorized(res);
        return;
      }

      const payload = await withKnownInstallationToken(authorized.installationId, async (token) => {
        const ref = requestedRef || authorized.repository.defaultBranch || 'main';
        const tree = await githubRequest<GitHubTreePayload>(
          `/repos/${req.params.owner}/${req.params.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
          {},
          token,
        );
        const inspection = await inspectRepositoryWorkspace(req.params.owner, req.params.repo, ref, token, tree.tree);
        const entrypointCandidates = deriveEntrypointCandidates(inspection.tree, inspection.packageManifest);

        return {
          repository: authorized.repository,
          ref,
          subPath: inspection.subPath || undefined,
          entrypointCandidates,
          suggestedEntrypoint: inspection.deliveryKind === 'website' ? '' : (entrypointCandidates[0] ?? ''),
          suggestedFunctionName: authorized.repository.repo.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase(),
          framework: inspection.framework,
          deliveryKind: inspection.deliveryKind,
        };
      });
      res.json(payload);
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  router.get('/repos/:owner/:repo/git/trees/:ref', async (req, res) => {
    try {
      const authorized = await loadAuthorizedRepository(req, req.params.owner, req.params.repo);
      if (!authorized) {
        sendUnauthorized(res);
        return;
      }

      const recursiveQuery = req.query.recursive ? '?recursive=1' : '';
      const payload = await withKnownInstallationToken(authorized.installationId, async (token) => (
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
      const authorized = await loadAuthorizedRepository(req, req.params.owner, req.params.repo);
      if (!authorized) {
        sendUnauthorized(res);
        return;
      }

      const ref = `${req.query.ref ?? ''}`.trim();
      const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const payload = await withKnownInstallationToken(authorized.installationId, async (token) => (
        githubRequest(`/repos/${req.params.owner}/${req.params.repo}/contents/${filePath}${suffix}`, {}, token)
      ));
      res.json(payload);
    } catch (error) {
      sendGitHubError(res, error);
    }
  });

  return router;
}
