import React, { useEffect, useMemo, useState } from 'react';
import { CyanBtn, GhostBtn, SelectInput, TextInput } from '../UI';
import {
  GitHubAppStatus,
  GitHubInstallation,
  GitHubRepository,
  getGitHubAppStatus,
  inspectGitHubRepository,
  listGitHubInstallations,
  listGitHubRepositories,
} from '../../lib/github-app';

export interface GitHubDeploySubmission {
  functionName: string;
  installationId: number;
  owner: string;
  repo: string;
  repoFullName: string;
  gitUrl: string;
  gitRef: string;
  entrypoint: string;
}

interface GitHubDeployFormProps {
  environment: 'Production' | 'Staging' | 'Preview';
  region: string;
  regionOptions: string[];
  isSubmitting: boolean;
  error: string | null;
  onEnvironmentChange: (value: 'Production' | 'Staging' | 'Preview') => void;
  onRegionChange: (region: string) => void;
  onCancel: () => void;
  onDeploy: (request: GitHubDeploySubmission) => Promise<void>;
}

export function GitHubDeployForm({
  environment,
  region,
  regionOptions,
  isSubmitting,
  error,
  onEnvironmentChange,
  onRegionChange,
  onCancel,
  onDeploy,
}: GitHubDeployFormProps) {
  const [status, setStatus] = useState<GitHubAppStatus | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallationID, setSelectedInstallationID] = useState<number | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoFilter, setRepoFilter] = useState('');
  const [branch, setBranch] = useState('');
  const [entrypoint, setEntrypoint] = useState('');
  const [entrypointCandidates, setEntrypointCandidates] = useState<string[]>([]);
  const [functionName, setFunctionName] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [installationsError, setInstallationsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([getGitHubAppStatus(), listGitHubInstallations()])
      .then(([statusResult, installationsResult]) => {
        if (cancelled) {
          return;
        }

        if (statusResult.status === 'fulfilled') {
          setStatus(statusResult.value);
          setStatusError(null);
        } else {
          setStatus(null);
          setStatusError(statusResult.reason instanceof Error ? statusResult.reason.message : 'Unable to load GitHub App status.');
        }

        if (installationsResult.status === 'fulfilled') {
          setInstallations(installationsResult.value);
          setInstallationsError(null);
          setSelectedInstallationID((current) => current ?? installationsResult.value[0]?.id ?? null);
        } else {
          setInstallations([]);
          setInstallationsError(
            installationsResult.reason instanceof Error
              ? installationsResult.reason.message
              : 'Unable to load GitHub App installations.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedInstallationID) {
      setRepositories([]);
      setSelectedRepoFullName('');
      return;
    }

    let cancelled = false;
    setLoadingRepos(true);
    setLocalError(null);

    void listGitHubRepositories(selectedInstallationID)
      .then((nextRepositories) => {
        if (cancelled) {
          return;
        }
        setRepositories(nextRepositories);
        setSelectedRepoFullName((current) => {
          if (current && nextRepositories.some((repo) => repo.fullName === current)) {
            return current;
          }
          return nextRepositories[0]?.fullName ?? '';
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setRepositories([]);
          setSelectedRepoFullName('');
          setLocalError(err instanceof Error ? err.message : 'Unable to load repositories.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRepos(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedInstallationID]);

  const filteredRepositories = useMemo(() => {
    const query = repoFilter.trim().toLowerCase();
    if (!query) {
      return repositories;
    }
    return repositories.filter((repo) => repo.fullName.toLowerCase().includes(query));
  }, [repositories, repoFilter]);

  useEffect(() => {
    if (!selectedRepoFullName || filteredRepositories.some((repo) => repo.fullName === selectedRepoFullName)) {
      return;
    }
    setSelectedRepoFullName(filteredRepositories[0]?.fullName ?? '');
  }, [filteredRepositories, selectedRepoFullName]);

  const selectedRepo = useMemo(
    () => repositories.find((repo) => repo.fullName === selectedRepoFullName) ?? null,
    [repositories, selectedRepoFullName],
  );

  const inspectRepositorySelection = async (owner: string, repo: string) => {
    setLoadingInspection(true);
    setLocalError(null);
    try {
      const inspection = await inspectGitHubRepository(owner, repo);
      setSelectedInstallationID((current) => inspection.repository.installationId ?? current);
      setRepositories((current) => {
        if (current.some((item) => item.fullName === inspection.repository.fullName)) {
          return current;
        }
        return [inspection.repository, ...current];
      });
      setSelectedRepoFullName(inspection.repository.fullName);
      setBranch(inspection.ref || inspection.repository.defaultBranch);
      setEntrypoint(inspection.suggestedEntrypoint);
      setEntrypointCandidates(inspection.entrypointCandidates);
      setFunctionName(inspection.suggestedFunctionName);
      setRepoUrl(inspection.repository.htmlUrl ?? `https://github.com/${inspection.repository.fullName}`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to inspect repository.');
    } finally {
      setLoadingInspection(false);
    }
  };

  useEffect(() => {
    if (!selectedRepo) {
      setBranch('');
      setEntrypoint('');
      setEntrypointCandidates([]);
      setFunctionName('');
      return;
    }

    let cancelled = false;
    setRepoUrl(selectedRepo.htmlUrl ?? `https://github.com/${selectedRepo.fullName}`);
    setLoadingInspection(true);
    setLocalError(null);
    void inspectGitHubRepository(selectedRepo.owner, selectedRepo.repo)
      .then((inspection) => {
        if (cancelled) {
          return;
        }
        setBranch((current) => current || inspection.ref || selectedRepo.defaultBranch);
        setEntrypoint(inspection.suggestedEntrypoint);
        setEntrypointCandidates(inspection.entrypointCandidates);
        setFunctionName((current) => current || inspection.suggestedFunctionName);
      })
      .catch((err) => {
        if (!cancelled) {
          setLocalError(err instanceof Error ? err.message : 'Unable to inspect repository.');
          setBranch(selectedRepo.defaultBranch);
          setEntrypoint('');
          setEntrypointCandidates([]);
          setFunctionName(selectedRepo.repo.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingInspection(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRepo]);

  const parseGitHubRepositoryInput = (value: string): { owner: string; repo: string } | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    try {
      const url = new URL(trimmed);
      if (url.hostname !== 'github.com') {
        return null;
      }
      const segments = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
      if (segments.length < 2) {
        return null;
      }
      return {
        owner: segments[0],
        repo: segments[1].replace(/\.git$/i, ''),
      };
    } catch {
      const parts = trimmed.replace(/^\/+|\/+$/g, '').split('/');
      if (parts.length === 2) {
        return {
          owner: parts[0],
          repo: parts[1].replace(/\.git$/i, ''),
        };
      }
      return null;
    }
  };

  const handleDeploy = async () => {
    if (!selectedRepo || !selectedInstallationID) {
      setLocalError('Select an installed repository before deploying.');
      return;
    }
    if (!entrypoint.trim()) {
      setLocalError('Entrypoint is required for git deploys.');
      return;
    }
    if (!functionName.trim()) {
      setLocalError('Function name is required.');
      return;
    }

    setLocalError(null);
    try {
      await onDeploy({
        functionName: functionName.trim(),
        installationId: selectedInstallationID,
        owner: selectedRepo.owner,
        repo: selectedRepo.repo,
        repoFullName: selectedRepo.fullName,
        gitUrl: selectedRepo.gitUrl ?? `https://github.com/${selectedRepo.fullName}.git`,
        gitRef: branch.trim() || selectedRepo.defaultBranch,
        entrypoint: entrypoint.trim(),
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'GitHub deploy failed.');
    }
  };

  const handleUseRepositoryURL = async () => {
    const parsed = parseGitHubRepositoryInput(repoUrl);
    if (!parsed) {
      setLocalError('Enter a valid GitHub repository URL or owner/repo pair.');
      return;
    }
    await inspectRepositorySelection(parsed.owner, parsed.repo);
  };

  const combinedError = localError || installationsError || error;
  const appInstallUrl = status?.installUrl;
  const appConfigured = status?.configured === true;
  const appKnownNotConfigured = status?.configured === false;
  const installationOptions = installations.map((installation) => `${installation.accountLogin} (#${installation.id})`);
  const selectedInstallationLabel = installations.find((installation) => installation.id === selectedInstallationID)
    ? `${installations.find((installation) => installation.id === selectedInstallationID)?.accountLogin} (#${selectedInstallationID})`
    : installationOptions[0] ?? '';
  const repositoryOptions = filteredRepositories.map((repo) => repo.fullName);

  return (
    <div className="max-w-[680px]">
      <p className="text-[12px] text-sub mb-8">
        Deploy directly from repositories your GitHub App installation can access. The control plane will clone the repo, build it, and package an immutable function artifact from git.
      </p>

      <div className="mb-8">
        <div className="border border-border bg-surface p-6 rounded">
          <p className="text-[12px] text-white mb-2">GitHub App</p>
          {loadingStatus ? (
            <p className="text-[10px] text-sub">Checking GitHub App configuration...</p>
          ) : appConfigured ? (
            <>
              <p className="text-[11px] text-cyan-primary">
                {status?.name || 'GitHub App'} is configured{status?.slug ? ` (${status.slug})` : ''}.
              </p>
              {installations.length > 0 ? (
                <p className="text-[10px] text-sub mt-2">
                  Select one of the GitHub App installations your signed-in account can access, or paste a repository URL below.
                </p>
              ) : (
                <p className="text-[10px] text-sub mt-2">
                  The app is configured, but your signed-in GitHub account does not have any accessible Lecrev App installations yet. Install the app on a repository or organization, then refresh this step.
                </p>
              )}
              {statusError && (
                <p className="text-[10px] text-amber-300 mt-2">
                  {statusError}
                </p>
              )}
              {appInstallUrl && (
                <div className="mt-4">
                  <GhostBtn
                    onClick={() => {
                      window.open(appInstallUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Install GitHub App
                  </GhostBtn>
                </div>
              )}
            </>
          ) : appKnownNotConfigured ? (
            <p className="text-[10px] text-amber-300">
              GitHub App credentials are not configured yet. Add `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY_PATH`.
            </p>
          ) : (
            <p className="text-[10px] text-amber-300">
              Unable to verify GitHub App status right now. {statusError ?? 'Try refreshing this page.'}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <SelectInput
          label="Installation"
          options={installationOptions.length ? installationOptions : ['No installations found']}
          value={selectedInstallationLabel}
          onChange={(value) => {
            const match = installations.find((installation) => `${installation.accountLogin} (#${installation.id})` === value);
            setSelectedInstallationID(match?.id ?? null);
            setRepoFilter('');
            setFunctionName('');
          }}
        />
        <TextInput
          label="Repository Search"
          value={repoFilter}
          onChange={setRepoFilter}
          placeholder="Filter accessible repositories"
        />
      </div>

      <div className="mb-6">
        <SelectInput
          label="Repository"
          options={repositoryOptions.length ? repositoryOptions : [loadingRepos ? 'Loading repositories…' : 'No accessible repositories']}
          value={selectedRepoFullName}
          onChange={setSelectedRepoFullName}
        />
        <p className="text-[10px] text-muted mt-2">
          {selectedRepo ? `${selectedRepo.private ? 'Private' : 'Public'} repository via installation ${selectedRepo.installationId ?? selectedInstallationID ?? '-'}` : 'Select an installation-scoped repository to continue.'}
        </p>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <TextInput
            label="GitHub Repository URL"
            value={repoUrl}
            onChange={setRepoUrl}
            placeholder="https://github.com/owner/repo"
          />
          <GhostBtn
            onClick={() => {
              void handleUseRepositoryURL();
            }}
            disabled={loadingInspection || !repoUrl.trim()}
            className="h-[41px]"
          >
            {loadingInspection ? 'Inspecting…' : 'Use URL'}
          </GhostBtn>
        </div>
        <p className="text-[10px] text-muted mt-2">
          Paste a GitHub URL if the repository is not convenient to pick from the installation list.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <TextInput
          label="Function Name"
          value={functionName}
          onChange={setFunctionName}
          placeholder="repo-backed-function"
        />
        <TextInput
          label="Branch / Ref"
          value={branch}
          onChange={setBranch}
          placeholder="main"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <SelectInput
          label="Suggested Entrypoints"
          options={entrypointCandidates.length ? entrypointCandidates : [loadingInspection ? 'Inspecting repository…' : 'No entrypoints found']}
          value={entrypointCandidates.includes(entrypoint) ? entrypoint : entrypointCandidates[0] ?? ''}
          onChange={setEntrypoint}
        />
        <TextInput
          label="Entrypoint"
          value={entrypoint}
          onChange={setEntrypoint}
          placeholder="dist/index.js"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <SelectInput
          label="Environment"
          options={['Production', 'Staging', 'Preview']}
          value={environment}
          onChange={(value) => onEnvironmentChange(value as 'Production' | 'Staging' | 'Preview')}
        />
        <SelectInput
          label="Region"
          options={regionOptions.length ? regionOptions : ['ap-south-1']}
          value={region}
          onChange={onRegionChange}
        />
      </div>

      {combinedError && (
        <div className="mb-8 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400 rounded">{combinedError}</div>
      )}

      <div className="flex gap-3">
        <CyanBtn
          onClick={() => void handleDeploy()}
          disabled={isSubmitting || loadingInspection || !appConfigured || !selectedRepo || !entrypoint.trim() || !functionName.trim()}
        >
          {isSubmitting ? 'Deploying...' : 'Deploy From GitHub →'}
        </CyanBtn>
        <GhostBtn onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </GhostBtn>
      </div>
    </div>
  );
}
