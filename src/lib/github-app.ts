export interface GitHubAppStatus {
  configured: boolean;
  appId?: string;
  slug?: string;
  name?: string;
  installUrl?: string;
}

export interface GitHubInstallation {
  id: number;
  accountLogin: string;
  accountType: string;
  avatarUrl?: string;
  repositorySelection: string;
}

export interface GitHubRepository {
  id: number;
  installationId?: number;
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl?: string;
  gitUrl?: string;
}

export interface GitHubRepoInspection {
  repository: GitHubRepository;
  ref: string;
  entrypointCandidates: string[];
  suggestedEntrypoint: string;
  suggestedFunctionName: string;
}

export interface GitHubDeploymentBindingInput {
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
}

export interface GitHubDeploymentBinding {
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

export interface GitHubBindingDeployment {
  functionVersionId: string;
  buildJobId?: string;
}

export interface GitHubDeploymentBindingResponse {
  binding: GitHubDeploymentBinding;
  deployment?: GitHubBindingDeployment;
}

interface GitHubInstallationsResponse {
  configured: boolean;
  installations: GitHubInstallation[];
}

interface GitHubRepoListResponse {
  installationId: number;
  page: number;
  perPage: number;
  totalCount: number;
  hasNextPage: boolean;
  repositories: GitHubRepository[];
}

async function requestGitHubApp<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
    },
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw.trim() || `GitHub request failed with ${response.status}`);
  }
  return raw ? JSON.parse(raw) as T : (undefined as T);
}

export async function getGitHubAppStatus(): Promise<GitHubAppStatus> {
  return requestGitHubApp<GitHubAppStatus>('/api/github/app');
}

export async function listGitHubInstallations(): Promise<GitHubInstallation[]> {
  const payload = await requestGitHubApp<GitHubInstallationsResponse>('/api/github/installations');
  return payload.installations ?? [];
}

export async function listGitHubRepositories(installationId: number, query = ''): Promise<GitHubRepository[]> {
  const params = new URLSearchParams({
    installationId: String(installationId),
  });
  if (query.trim()) {
    params.set('q', query.trim());
  }

  const payload = await requestGitHubApp<GitHubRepoListResponse>(`/api/github/repos?${params.toString()}`);
  return payload.repositories ?? [];
}

export async function inspectGitHubRepository(owner: string, repo: string, ref?: string): Promise<GitHubRepoInspection> {
  const params = new URLSearchParams();
  if (ref?.trim()) {
    params.set('ref', ref.trim());
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestGitHubApp<GitHubRepoInspection>(`/api/github/repos/${owner}/${repo}/inspect${suffix}`);
}

export async function registerGitHubDeploymentBinding(input: GitHubDeploymentBindingInput): Promise<void> {
  await createGitHubDeploymentBinding(input);
}

export async function createGitHubDeploymentBinding(
  input: GitHubDeploymentBindingInput & { deployNow?: boolean },
): Promise<GitHubDeploymentBindingResponse> {
  return fetch('/api/github/deployments/bindings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  }).then(async (response) => {
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(raw.trim() || `GitHub binding registration failed with ${response.status}`);
    }
    return raw ? JSON.parse(raw) as GitHubDeploymentBindingResponse : ({ binding: undefined } as GitHubDeploymentBindingResponse);
  });
}
