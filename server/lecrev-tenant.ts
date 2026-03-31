import crypto from 'node:crypto';
import pg from 'pg';
import {
  getGitHubUserConnection,
  GitHubUserConnection,
  upsertGitHubUserConnection,
} from './github-deployments-store';

const { Client } = pg;

const postgresDSN = (process.env.LECREV_POSTGRES_DSN ?? '').trim();
const publicAPIBaseURL = (process.env.VITE_LECREV_API_BASE_URL ?? process.env.LECREV_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

export interface GitHubViewer {
  id: string;
  login: string;
}

export interface LecrevUserConnection {
  baseUrl: string;
  apiKey: string;
  projectId: string;
  tenantId: string;
  projectName: string;
}

function hashAPIKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function generateRawAPIKey(): string {
  return `lcv_${crypto.randomBytes(24).toString('base64url')}`;
}

function buildTenantID(viewer: GitHubViewer): string {
  return `gh-user-${viewer.id}`;
}

function buildProjectID(viewer: GitHubViewer): string {
  return `gh-project-${viewer.id}`;
}

function buildProjectName(viewer: GitHubViewer): string {
  return `${viewer.login} personal`;
}

async function provisionBackendConnection(record: GitHubUserConnection): Promise<void> {
  if (!postgresDSN) {
    throw new Error('LECREV_POSTGRES_DSN is required for server-managed multi-tenant connections.');
  }

  const client = new Client({
    connectionString: postgresDSN,
  });
  const now = new Date();

  await client.connect();
  try {
    await client.query('begin');
    await client.query(`
      insert into tenants (id, name, created_at)
      values ($1, $2, $3)
      on conflict (id) do update set name = excluded.name
    `, [record.tenantId, record.githubLogin, now]);
    await client.query(`
      insert into projects (id, tenant_id, name, created_at)
      values ($1, $2, $3, $4)
      on conflict (id) do update set
        tenant_id = excluded.tenant_id,
        name = excluded.name
    `, [record.projectId, record.tenantId, buildProjectName({ id: record.githubAccountId, login: record.githubLogin }), now]);
    await client.query(`
      insert into api_keys (key_hash, tenant_id, description, is_admin, disabled, created_at, last_used_at)
      values ($1, $2, $3, false, false, $4, null)
      on conflict (key_hash) do update set
        tenant_id = excluded.tenant_id,
        description = excluded.description,
        is_admin = false,
        disabled = false
    `, [hashAPIKey(record.apiKey), record.tenantId, `github session for ${record.githubLogin}`, now]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

export async function ensureLecrevUserConnection(userId: string, viewer: GitHubViewer): Promise<LecrevUserConnection> {
  const existing = getGitHubUserConnection(userId);
  if (existing) {
    await provisionBackendConnection(existing);
    return {
      baseUrl: publicAPIBaseURL,
      apiKey: existing.apiKey,
      projectId: existing.projectId,
      tenantId: existing.tenantId,
      projectName: buildProjectName(viewer),
    };
  }

  const created = upsertGitHubUserConnection({
    userId,
    githubAccountId: viewer.id,
    githubLogin: viewer.login,
    tenantId: buildTenantID(viewer),
    projectId: buildProjectID(viewer),
    apiKey: generateRawAPIKey(),
  });
  await provisionBackendConnection(created);

  return {
    baseUrl: publicAPIBaseURL,
    apiKey: created.apiKey,
    projectId: created.projectId,
    tenantId: created.tenantId,
    projectName: buildProjectName(viewer),
  };
}

export function getLecrevUserConnection(userId: string): GitHubUserConnection | null {
  return getGitHubUserConnection(userId);
}
