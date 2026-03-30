export interface GitHubAppStatus {
  configured: boolean;
  appId?: string;
  slug?: string;
  name?: string;
  installUrl?: string;
}

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

interface GitHubTreeEntry {
  path: string;
  sha: string;
  url: string;
  type: 'blob' | 'tree';
}

function decodeBase64Content(base64: string): string {
  return decodeURIComponent(escape(window.atob(base64)));
}

export function parseGitHubRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'github.com' && url.pathname) {
      candidate = url.pathname.replace(/^\//, '').replace(/\.git$/, '');
    }
  } catch {
    // not a URL
  }
  const parts = candidate.replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

async function requestGitHubApp<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Accept': 'application/json',
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

async function getGitHubRepo(owner: string, repo: string): Promise<GitHubRepoInfo> {
  return requestGitHubApp<GitHubRepoInfo>(`/api/github/repos/${owner}/${repo}`);
}

async function getGitHubRepoTree(owner: string, repo: string, ref: string): Promise<{ tree: GitHubTreeEntry[] }> {
  const params = new URLSearchParams({ recursive: '1' });
  return requestGitHubApp<{ tree: GitHubTreeEntry[] }>(`/api/github/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?${params.toString()}`);
}

async function getGitHubRepoContent(owner: string, repo: string, filePath: string, ref: string): Promise<{ content: string }> {
  const params = new URLSearchParams({
    path: filePath,
    ref,
  });
  return requestGitHubApp<{ content: string }>(`/api/github/repos/${owner}/${repo}/contents?${params.toString()}`);
}

export async function importGitHubRepository(repoInput: string): Promise<{
  entrypoint: string;
  inlineFiles: Record<string, string>;
  repoFullName: string;
}> {
  const parsed = parseGitHubRepo(repoInput);
  if (!parsed) {
    throw new Error('Invalid repo format. Use owner/repo or a GitHub URL.');
  }

  const repo = await getGitHubRepo(parsed.owner, parsed.repo);
  const branch = repo.defaultBranch || 'main';
  const tree = await getGitHubRepoTree(parsed.owner, parsed.repo, branch);

  const jsFiles = (tree.tree || []).filter(
    (item) => item.type === 'blob' && /\.(js|mjs|ts|tsx)$/.test(item.path),
  );
  if (jsFiles.length === 0) {
    throw new Error('No JavaScript or TypeScript files found in the repository.');
  }

  const mainFile = jsFiles.find((entry) => /(^|\/)(index|main|handler)\.(js|mjs|ts|tsx)$/.test(entry.path)) || jsFiles[0];
  const contentData = await getGitHubRepoContent(parsed.owner, parsed.repo, mainFile.path, branch);

  return {
    entrypoint: mainFile.path,
    inlineFiles: {
      [mainFile.path]: decodeBase64Content(contentData.content.replace(/\n/g, '')),
    },
    repoFullName: repo.fullName,
  };
}
