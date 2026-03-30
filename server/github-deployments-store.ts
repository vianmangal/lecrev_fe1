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

db.exec(`
  create table if not exists github_repo_bindings (
    id text primary key,
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
    unique (installation_id, owner, repo, git_ref, project_id, function_name)
  );

  create table if not exists github_deployment_runs (
    id text primary key,
    binding_id text not null,
    installation_id integer not null,
    owner text not null,
    repo text not null,
    repo_full_name text not null,
    git_ref text not null,
    commit_sha text not null,
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

  create unique index if not exists github_deployment_runs_binding_commit_idx
    on github_deployment_runs(binding_id, commit_sha);
`);

export interface GitHubRepoBinding {
  id: string;
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
  installationId: number;
  owner: string;
  repo: string;
  repoFullName: string;
  gitRef: string;
  commitSha: string;
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
  installationId: number;
  owner: string;
  repo: string;
  repoFullName: string;
  gitRef: string;
  commitSha: string;
  functionVersionId: string;
  buildJobId?: string;
  statusContext: string;
  targetUrl?: string;
}

function rowToBinding(row: Record<string, unknown>): GitHubRepoBinding {
  return {
    id: String(row.id),
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
    installationId: Number(row.installation_id),
    owner: String(row.owner),
    repo: String(row.repo),
    repoFullName: String(row.repo_full_name),
    gitRef: String(row.git_ref),
    commitSha: String(row.commit_sha),
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

export function upsertGitHubRepoBinding(input: UpsertGitHubRepoBindingInput): GitHubRepoBinding {
  const now = new Date().toISOString();
  const existing = db.prepare(`
    select *
    from github_repo_bindings
    where installation_id = ?
      and owner = ?
      and repo = ?
      and git_ref = ?
      and project_id = ?
      and function_name = ?
  `).get(
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
      set repo_full_name = ?,
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
      id, installation_id, owner, repo, repo_full_name, git_url, git_ref, entrypoint,
      project_id, function_name, environment, region, auto_deploy,
      last_function_version_id, last_build_job_id, last_commit_sha, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
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

export function listGitHubRepoBindings(): GitHubRepoBinding[] {
  const rows = db.prepare('select * from github_repo_bindings order by updated_at desc').all() as Record<string, unknown>[];
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
  return rows.map(rowToBinding);
}

export function createGitHubDeploymentRun(input: CreateGitHubDeploymentRunInput): GitHubDeploymentRun {
  const existing = db.prepare(`
    select *
    from github_deployment_runs
    where binding_id = ? and commit_sha = ?
  `).get(input.bindingId, input.commitSha) as Record<string, unknown> | undefined;
  if (existing) {
    return rowToRun(existing);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    insert into github_deployment_runs (
      id, binding_id, installation_id, owner, repo, repo_full_name, git_ref, commit_sha,
      function_version_id, build_job_id, state, status_context, target_url, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.bindingId,
    input.installationId,
    input.owner,
    input.repo,
    input.repoFullName,
    input.gitRef,
    input.commitSha,
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
