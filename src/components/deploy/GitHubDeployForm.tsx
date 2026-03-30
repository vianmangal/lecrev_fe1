import React, { useEffect, useState } from 'react';
import { CyanBtn, GhostBtn, SelectInput, TextInput } from '../UI';
import { GitHubAppStatus, getGitHubAppStatus, importGitHubRepository } from '../../lib/github-app';

interface GitHubDeployFormProps {
  repoInput: string;
  environment: 'Production' | 'Staging' | 'Preview';
  region: string;
  regionOptions: string[];
  isSubmitting: boolean;
  error: string | null;
  onRepoInputChange: (value: string) => void;
  onEnvironmentChange: (value: 'Production' | 'Staging' | 'Preview') => void;
  onRegionChange: (region: string) => void;
  onCancel: () => void;
  onDeploy: (bundle: { entrypoint: string; inlineFiles: Record<string, string>; repoFullName: string }) => Promise<void>;
}

export function GitHubDeployForm({
  repoInput,
  environment,
  region,
  regionOptions,
  isSubmitting,
  error,
  onRepoInputChange,
  onEnvironmentChange,
  onRegionChange,
  onCancel,
  onDeploy,
}: GitHubDeployFormProps) {
  const [status, setStatus] = useState<GitHubAppStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getGitHubAppStatus()
      .then((nextStatus) => {
        if (!cancelled) {
          setStatus(nextStatus);
        }
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

  const handleDeploy = async () => {
    setLocalError(null);
    try {
      const bundle = await importGitHubRepository(repoInput);
      await onDeploy(bundle);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'GitHub import failed.');
    }
  };

  const combinedError = localError || error;
  const appInstallUrl = status?.installUrl;
  const appConfigured = Boolean(status?.configured);

  return (
    <div className="max-w-[600px]">
      <p className="text-[12px] text-sub mb-8">
        Import a GitHub repository through the configured GitHub App and deploy its primary runnable entrypoint.
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
                If the target repo is not installed yet, install the app for that account or repository first.
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

      <div className="mb-6">
        <TextInput
          label="Repository"
          value={repoInput}
          onChange={onRepoInputChange}
          placeholder="owner/repo or https://github.com/owner/repo"
        />
        <p className="text-[10px] text-muted mt-2">Example: `octocat/hello-world`</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <SelectInput
          label="Environment"
          options={['Production', 'Staging', 'Preview']}
          value={environment}
          onChange={(value) => onEnvironmentChange(value as 'Production' | 'Staging' | 'Preview')}
        />
        <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={onRegionChange} />
      </div>

      {combinedError && (
        <div className="mb-8 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400 rounded">{combinedError}</div>
      )}

      <div className="flex gap-3">
        <CyanBtn onClick={() => void handleDeploy()} disabled={isSubmitting || !repoInput.trim() || !appConfigured}>
          {isSubmitting ? 'Deploying...' : 'Import & Deploy →'}
        </CyanBtn>
        <GhostBtn onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </GhostBtn>
      </div>
    </div>
  );
}
