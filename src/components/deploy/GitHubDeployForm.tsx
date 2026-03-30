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
  const [repoFilter, setRepoFilter] = useState('');
  const [branch, setBranch] = useState('');
  const [entrypoint, setEntrypoint] = useState('');
  const [entrypointCandidates, setEntrypointCandidates] = useState<string[]>([]);
  const [functionName, setFunctionName] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getGitHubAppStatus(), listGitHubInstallations()])
      .then(([nextStatus, nextInstallations]) => {
        if (cancelled) {
          return;
        }
        setStatus(nextStatus);
        setInstallations(nextInstallations);
        setSelectedInstallationID((current) => current ?? nextInstallations[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setLocalError(err instanceof Error ? err.message : 'Unable to load GitHub App status.');
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

  useEffect(() => {
    if (!selectedRepo) {
      setBranch('');
      setEntrypoint('');
      setEntrypointCandidates([]);
      setFunctionName('');
      return;
    }

    let cancelled = false;
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

  const combinedError = localError || error;
  const appInstallUrl = status?.installUrl;
  const appConfigured = Boolean(status?.configured);
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
              <p className="text-[10px] text-sub mt-2">
                Install the app on a repository or organization first, then choose from the accessible installation list below.
              </p>
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
          ) : (
            <p className="text-[10px] text-amber-300">
              GitHub App credentials are not configured yet. Add `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY_PATH`.
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
          disabled={isSubmitting || !appConfigured || !selectedRepo || !entrypoint.trim() || !functionName.trim()}
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
