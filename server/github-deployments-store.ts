import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const rawDBPath = (process.env.GITHUB_APP_DB_PATH ?? './data/github-app.sqlite').trim();
const dbPath = path.isAbsolute(rawDBPath) ? rawDBPath : path.resolve(process.cwd(), rawDBPath);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

const createBindingsTableSQL = `
  create table if not exists github_repo_bindings (
    id text primary key,
    user_id text not null,
    tenant_id text not null,
    installation_id integer not null,
    owner text not null,
    repo text not null,
    repo_full_name text not null,
    git_url text not null,
    git_ref text not null,
    entrypoint text not null,
    project_id text not null,
    function_name text not null,
    environment text not null,
    region text not null,
    auto_deploy integer not null default 1,
    last_function_version_id text,
    last_build_job_id text,
    last_commit_sha text,
    created_at text not null,
    updated_at text not null,
    unique (user_id, installation_id, owner, repo, git_ref, project_id, function_name)
  );
`;

const createRunsTableSQL = `
  create table if not exists github_deployment_runs (
    id text primary key,
    binding_id text not null,
    user_id text not null,
    tenant_id text not null,
    project_id text not null,
    installation_id integer not null,
    owner text not null,
    repo text not null,
    repo_full_name text not null,
    git_ref text not null,
    commit_sha text not null,
    event_type text not null,
    environment text not null,
    pr_number integer,
    function_version_id text not null,
    build_job_id text,
    state text not null,
    status_context text not null,
    target_url text,
    last_error text,
    created_at text not null,
    updated_at text not null,
    foreign key (binding_id) references github_repo_bindings(id)
  );
`;

function columnNames(tableName: string): Set<string> {
  const rows = db.prepare(`pragma table_info(${tableName})`).all() as Array<{ name?: unknown }>;
  return new Set(rows.map((row) => String(row.name ?? '')));
}

function tableExists(tableName: string): boolean {
  const row = db.prepare(`
    select name
    from sqlite_master
    where type = 'table' and name = ?
  `).get(tableName) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function migrateBindingsTable(): void {
  if (!tableExists('github_repo_bindings')) {
    db.exec(createBindingsTableSQL);
    return;
  }

  const columns = columnNames('github_repo_bindings');
  if (columns.has('user_id') && columns.has('tenant_id')) {
    return;
  }

  db.exec(`
    pragma foreign_keys = off;
    alter table github_repo_bindings rename to github_repo_bindings_legacy;
    ${createBindingsTableSQL}
    insert into github_repo_bindings (
      id,
      user_id,
      tenant_id,
      installation_id,
      owner,
      repo,
      repo_full_name,
      git_url,
      git_ref,
      entrypoint,
      project_id,
      function_name,
      environment,
      region,
      auto_deploy,
      last_function_version_id,
      last_build_job_id,
      last_commit_sha,
      created_at,
      updated_at
    )
    select
      id,
      'legacy',
      'legacy',
      installation_id,
      owner,
      repo,
      repo_full_name,
      git_url,
      git_ref,
      entrypoint,
      project_id,
      function_name,
      environment,
      region,
      auto_deploy,
      last_function_version_id,
      last_build_job_id,
      last_commit_sha,
      created_at,
      updated_at
    from github_repo_bindings_legacy;
    drop table github_repo_bindings_legacy;
    pragma foreign_keys = on;
  `);
}

function migrateRunsTable(): void {
  if (!tableExists('github_deployment_runs')) {
    db.exec(createRunsTableSQL);
  } else {
    const columns = columnNames('github_deployment_runs');
    if (!columns.has('user_id')) {
      db.exec(`alter table github_deployment_runs add column user_id text not null default 'legacy';`);
    }
    if (!columns.has('tenant_id')) {
      db.exec(`alter table github_deployment_runs add column tenant_id text not null default 'legacy';`);
    }
    if (!columns.has('project_id')) {
      db.exec(`alter table github_deployment_runs add column project_id text not null default 'legacy';`);
    }
    if (!columns.has('event_type')) {
      db.exec(`alter table github_deployment_runs add column event_type text not null default 'push';`);
    }
    if (!columns.has('environment')) {
      db.exec(`alter table github_deployment_runs add column environment text not null default 'production';`);
    }
    if (!columns.has('pr_number')) {
      db.exec(`alter table github_deployment_runs add column pr_number integer;`);
    }
  }

  db.exec(`
    drop index if exists github_deployment_runs_binding_commit_idx;
    create unique index if not exists github_deployment_runs_binding_commit_event_idx
      on github_deployment_runs(binding_id, commit_sha, event_type, ifnull(pr_number, 0));
  `);
}

migrateBindingsTable();
migrateRunsTable();

db.exec(`
  create table if not exists github_user_connections (
    user_id text primary key,
    github_account_id text not null,
    github_login text not null,
    tenant_id text not null,
    project_id text not null,
    api_key text not null,
    created_at text not null,
    updated_at text not null
  );
`);

export interface GitHubUserConnection {
  userId: string;
  githubAccountId: string;
  githubLogin: string;
  tenantId: string;
  projectId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertGitHubUserConnectionInput {
  userId: string;
  githubAccountId: string;
  githubLogin: string;
  tenantId: string;
  projectId: string;
  apiKey: string;
}

export interface GitHubRepoBinding {
  id: string;
  userId: string;
  tenantId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface UpsertGitHubRepoBindingInput {
  userId: string;
  tenantId: string;
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
  autoDeploy?: boolean;
  lastFunctionVersionId?: string;
  lastBuildJobId?: string;
  lastCommitSha?: string;
}

export interface GitHubDeploymentRun {
  id: string;
  bindingId: string;
  userId: string;
  tenantId: string;
  projectId: string;
  installationId: number;
  owner: string;
  repo: string;
  repoFullName: string;
  gitRef: string;
  commitSha: string;
  eventType: 'push' | 'pull_request';
  environment: 'production' | 'staging' | 'preview';
  prNumber?: number;
  functionVersionId: string;
  buildJobId?: string;
  state: 'pending' | 'succeeded' | 'failed';
  statusContext: string;
  targetUrl?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGitHubDeploymentRunInput {
  bindingId: string;
  userId: string;
  tenantId: string;
  projectId: string;
  installationId: number;
  owner: string;
  repo: string;
  repoFullName: string;
  gitRef: string;
  commitSha: string;
  eventType: 'push' | 'pull_request';
  environment: 'production' | 'staging' | 'preview';
  prNumber?: number;
  functionVersionId: string;
  buildJobId?: string;
  statusContext: string;
  targetUrl?: string;
}

function rowToConnection(row: Record<string, unknown>): GitHubUserConnection {
  return {
    userId: String(row.user_id),
    githubAccountId: String(row.github_account_id),
    githubLogin: String(row.github_login),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    apiKey: String(row.api_key),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToBinding(row: Record<string, unknown>): GitHubRepoBinding {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tenantId: String(row.tenant_id),
    installationId: Number(row.installation_id),
    owner: String(row.owner),
    repo: String(row.repo),
    repoFullName: String(row.repo_full_name),
    gitUrl: String(row.git_url),
    gitRef: String(row.git_ref),
    entrypoint: String(row.entrypoint),
    projectId: String(row.project_id),
    functionName: String(row.function_name),
    environment: String(row.environment) as GitHubRepoBinding['environment'],
    region: String(row.region),
    autoDeploy: Number(row.auto_deploy) === 1,
    lastFunctionVersionId: row.last_function_version_id ? String(row.last_function_version_id) : undefined,
    lastBuildJobId: row.last_build_job_id ? String(row.last_build_job_id) : undefined,
    lastCommitSha: row.last_commit_sha ? String(row.last_commit_sha) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToRun(row: Record<string, unknown>): GitHubDeploymentRun {
  return {
    id: String(row.id),
    bindingId: String(row.binding_id),
    userId: String(row.user_id),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    installationId: Number(row.installation_id),
    owner: String(row.owner),
    repo: String(row.repo),
    repoFullName: String(row.repo_full_name),
    gitRef: String(row.git_ref),
    commitSha: String(row.commit_sha),
    eventType: String(row.event_type) as GitHubDeploymentRun['eventType'],
    environment: String(row.environment) as GitHubDeploymentRun['environment'],
    prNumber: row.pr_number === null || row.pr_number === undefined ? undefined : Number(row.pr_number),
    functionVersionId: String(row.function_version_id),
    buildJobId: row.build_job_id ? String(row.build_job_id) : undefined,
    state: String(row.state) as GitHubDeploymentRun['state'],
    statusContext: String(row.status_context),
    targetUrl: row.target_url ? String(row.target_url) : undefined,
    lastError: row.last_error ? String(row.last_error) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function getGitHubUserConnection(userId: string): GitHubUserConnection | null {
  const row = db.prepare('select * from github_user_connections where user_id = ?').get(userId) as Record<string, unknown> | undefined;
  return row ? rowToConnection(row) : null;
}

export function upsertGitHubUserConnection(input: UpsertGitHubUserConnectionInput): GitHubUserConnection {
  const now = new Date().toISOString();
  db.prepare(`
    insert into github_user_connections (
      user_id,
      github_account_id,
      github_login,
      tenant_id,
      project_id,
      api_key,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id) do update set
      github_account_id = excluded.github_account_id,
      github_login = excluded.github_login,
      tenant_id = excluded.tenant_id,
      project_id = excluded.project_id,
      api_key = excluded.api_key,
      updated_at = excluded.updated_at
  `).run(
    input.userId,
    input.githubAccountId,
    input.githubLogin,
    input.tenantId,
    input.projectId,
    input.apiKey,
    now,
    now,
  );

  const row = db.prepare('select * from github_user_connections where user_id = ?').get(input.userId) as Record<string, unknown>;
  return rowToConnection(row);
}

export function upsertGitHubRepoBinding(input: UpsertGitHubRepoBindingInput): GitHubRepoBinding {
  const now = new Date().toISOString();
  const existing = db.prepare(`
    select *
    from github_repo_bindings
    where user_id = ?
      and installation_id = ?
      and owner = ?
      and repo = ?
      and git_ref = ?
      and project_id = ?
      and function_name = ?
  `).get(
    input.userId,
    input.installationId,
    input.owner,
    input.repo,
    input.gitRef,
    input.projectId,
    input.functionName,
  ) as Record<string, unknown> | undefined;

  if (existing) {
    const existingID = String(existing.id);
    db.prepare(`
      update github_repo_bindings
      set tenant_id = ?,
          repo_full_name = ?,
          git_url = ?,
          entrypoint = ?,
          environment = ?,
          region = ?,
          auto_deploy = ?,
          last_function_version_id = ?,
          last_build_job_id = ?,
          last_commit_sha = ?,
          updated_at = ?
      where id = ?
    `).run(
      input.tenantId,
      input.repoFullName,
      input.gitUrl,
      input.entrypoint,
      input.environment,
      input.region,
      input.autoDeploy === false ? 0 : 1,
      input.lastFunctionVersionId ?? null,
      input.lastBuildJobId ?? null,
      input.lastCommitSha ?? null,
      now,
      existingID,
    );

    const updated = db.prepare('select * from github_repo_bindings where id = ?').get(existingID) as Record<string, unknown>;
    return rowToBinding(updated);
  }

  const id = randomUUID();
  db.prepare(`
    insert into github_repo_bindings (
      id,
      user_id,
      tenant_id,
      installation_id,
      owner,
      repo,
      repo_full_name,
      git_url,
      git_ref,
      entrypoint,
      project_id,
      function_name,
      environment,
      region,
      auto_deploy,
      last_function_version_id,
      last_build_job_id,
      last_commit_sha,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.userId,
    input.tenantId,
    input.installationId,
    input.owner,
    input.repo,
    input.repoFullName,
    input.gitUrl,
    input.gitRef,
    input.entrypoint,
    input.projectId,
    input.functionName,
    input.environment,
    input.region,
    input.autoDeploy === false ? 0 : 1,
    input.lastFunctionVersionId ?? null,
    input.lastBuildJobId ?? null,
    input.lastCommitSha ?? null,
    now,
    now,
  );

  const created = db.prepare('select * from github_repo_bindings where id = ?').get(id) as Record<string, unknown>;
  return rowToBinding(created);
}

export function listGitHubRepoBindingsByUser(userId: string): GitHubRepoBinding[] {
  const rows = db.prepare(`
    select *
    from github_repo_bindings
    where user_id = ?
    order by updated_at desc
  `).all(userId) as Record<string, unknown>[];
  return rows.map(rowToBinding);
}

export function findBindingsForPush(installationId: number, owner: string, repo: string, gitRef: string): GitHubRepoBinding[] {
  const rows = db.prepare(`
    select *
    from github_repo_bindings
    where installation_id = ?
      and owner = ?
      and repo = ?
      and git_ref = ?
      and auto_deploy = 1
    order by updated_at desc
  `).all(installationId, owner, repo, gitRef) as Record<string, unknown>[];
  return rows
    .map(rowToBinding)
    .filter((binding) => getGitHubUserConnection(binding.userId) !== null);
}

export function findBindingsForPreview(installationId: number, owner: string, repo: string, baseRef: string): GitHubRepoBinding[] {
  return findBindingsForPush(installationId, owner, repo, baseRef);
}

export function createGitHubDeploymentRun(input: CreateGitHubDeploymentRunInput): GitHubDeploymentRun {
  const existing = db.prepare(`
    select *
    from github_deployment_runs
    where binding_id = ?
      and commit_sha = ?
      and event_type = ?
      and ifnull(pr_number, 0) = ifnull(?, 0)
  `).get(input.bindingId, input.commitSha, input.eventType, input.prNumber ?? null) as Record<string, unknown> | undefined;
  if (existing) {
    return rowToRun(existing);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    insert into github_deployment_runs (
      id,
      binding_id,
      user_id,
      tenant_id,
      project_id,
      installation_id,
      owner,
      repo,
      repo_full_name,
      git_ref,
      commit_sha,
      event_type,
      environment,
      pr_number,
      function_version_id,
      build_job_id,
      state,
      status_context,
      target_url,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.bindingId,
    input.userId,
    input.tenantId,
    input.projectId,
    input.installationId,
    input.owner,
    input.repo,
    input.repoFullName,
    input.gitRef,
    input.commitSha,
    input.eventType,
    input.environment,
    input.prNumber ?? null,
    input.functionVersionId,
    input.buildJobId ?? null,
    'pending',
    input.statusContext,
    input.targetUrl ?? null,
    now,
    now,
  );

  const row = db.prepare('select * from github_deployment_runs where id = ?').get(id) as Record<string, unknown>;
  return rowToRun(row);
}

export function listPendingGitHubDeploymentRuns(): GitHubDeploymentRun[] {
  const rows = db.prepare(`
    select *
    from github_deployment_runs
    where state = 'pending'
    order by created_at asc
  `).all() as Record<string, unknown>[];
  return rows.map(rowToRun);
}

export function markGitHubDeploymentRunState(runId: string, state: GitHubDeploymentRun['state'], lastError?: string): GitHubDeploymentRun {
  const now = new Date().toISOString();
  db.prepare(`
    update github_deployment_runs
    set state = ?, last_error = ?, updated_at = ?
    where id = ?
  `).run(state, lastError ?? null, now, runId);

  const row = db.prepare('select * from github_deployment_runs where id = ?').get(runId) as Record<string, unknown>;
  return rowToRun(row);
}
