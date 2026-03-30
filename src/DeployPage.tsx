import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ApiConnection, DeployRequestInput, LiveDeploymentRecord } from './api';
import { DeployMode, DeployModePicker } from './components/deploy/DeployModePicker';
import { FileDeployForm } from './components/deploy/FileDeployForm';
import { FunctionDeployForm } from './components/deploy/FunctionDeployForm';
import { GitHubDeployForm, GitHubDeploySubmission } from './components/deploy/GitHubDeployForm';
import { DeploySuccess } from './components/deploy/DeploySuccess';
import { registerGitHubDeploymentBinding } from './lib/github-app';

interface DeployPageProps {
  onBack: () => void;
  onDeploy: (request: DeployRequestInput) => Promise<{ versionId: string; buildJobId?: string }>;
  defaultProjectId: string;
  regionOptions: string[];
  liveDeployments: LiveDeploymentRecord[];
  connection: ApiConnection;
}

const DEFAULT_HANDLER = "export async function handler(event, context) {\n  return { ok: true, echo: event, region: context.region, hostId: context.hostId };\n}\n";

export const DeployPage: React.FC<DeployPageProps> = ({ onBack, onDeploy, defaultProjectId, regionOptions, liveDeployments, connection }) => {
  const [mode, setMode] = useState<DeployMode | null>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [functionVal, setFunctionVal] = useState(DEFAULT_HANDLER);
  const [environment, setEnvironment] = useState<'Production' | 'Staging' | 'Preview'>('Production');
  const [region, setRegion] = useState(regionOptions[0] || 'ap-south-1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployInfo, setDeployInfo] = useState<{ versionId: string; buildJobId?: string } | null>(null);
  const [deployed, setDeployed] = useState(false);

  const liveDeployment = deployInfo
    ? liveDeployments.find((record) => record.version.id === deployInfo.versionId) ?? null
    : null;

  useEffect(() => {
    if (regionOptions.length === 0) {
      setRegion('ap-south-1');
      return;
    }
    setRegion((current) => (regionOptions.includes(current) ? current : regionOptions[0]));
  }, [regionOptions]);

  const sanitizeName = (value: string): string => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || 'ui-function';
  };

  const reset = () => {
    setDeployed(false);
    setMode(null);
    setFile(null);
    setDeployInfo(null);
    setError(null);
  };

  const buildRequest = async (): Promise<DeployRequestInput> => {
    if (!mode) {
      throw new Error('Select a deployment mode first.');
    }

    const selectedRegion = region.trim() || regionOptions[0] || 'ap-south-1';
    const cleanedProject = defaultProjectId.trim() || 'default-project';
    const cleanedName = sanitizeName(mode === 'file' ? (file?.name || 'uploaded-function') : 'ui-function');

    if (mode === 'file') {
      if (!file) {
        throw new Error('Select a file before deploying.');
      }
      const content = await file.text();
      const entrypoint = file.name || 'index.mjs';
      return {
        projectId: cleanedProject,
        name: cleanedName,
        environment,
        region: selectedRegion,
        entrypoint,
        inlineFiles: {
          [entrypoint]: content,
        },
      };
    }

    return {
      projectId: cleanedProject,
      name: cleanedName,
      environment,
      region: selectedRegion,
      entrypoint: 'handler.mjs',
      inlineFiles: {
        'handler.mjs': functionVal,
      },
    };
  };

  const handleDirectDeploy = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const request = await buildRequest();
      const info = await onDeploy(request);
      setDeployInfo(info);
      setDeployed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubDeploy = async (submission: GitHubDeploySubmission) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const selectedRegion = region.trim() || regionOptions[0] || 'ap-south-1';
      const cleanedProject = defaultProjectId.trim() || 'default-project';
      const request: DeployRequestInput = {
        projectId: cleanedProject,
        name: sanitizeName(submission.functionName || submission.repoFullName.replace(/\//g, '-')),
        environment,
        region: selectedRegion,
        entrypoint: submission.entrypoint,
        gitUrl: submission.gitUrl,
        gitRef: submission.gitRef,
      };
      const info = await onDeploy(request);
      await registerGitHubDeploymentBinding({
        installationId: submission.installationId,
        owner: submission.owner,
        repo: submission.repo,
        repoFullName: submission.repoFullName,
        gitUrl: submission.gitUrl,
        gitRef: submission.gitRef,
        entrypoint: submission.entrypoint,
        projectId: cleanedProject,
        functionName: request.name,
        environment: environment.toLowerCase() as 'production' | 'staging' | 'preview',
        region: selectedRegion,
        autoDeploy: true,
        lastFunctionVersionId: info.versionId,
        lastBuildJobId: info.buildJobId,
      });
      setDeployInfo(info);
      setDeployed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed.');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (deployed) {
    return (
      <DeploySuccess
        deploymentId={deployInfo?.buildJobId || deployInfo?.versionId || 'deployment'}
        connection={connection}
        versionId={deployInfo?.versionId || ''}
        buildJobId={deployInfo?.buildJobId}
        record={liveDeployment}
        onReset={reset}
        onViewDeployments={onBack}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-sub bg-transparent border-none cursor-pointer mb-12 p-0 hover:text-white transition-colors"
      >
        ← Back
      </button>

      <div className="mb-16">
        <h2 className="text-3xl tracking-tighter font-normal mb-2">
          Deploy Your Project
        </h2>
        <p className="text-[13px] text-sub">Choose a deployment method that works best for you.</p>
      </div>

      <AnimatePresence mode="wait">
        {!mode ? (
          <DeployModePicker onSelect={setMode} />
        ) : (
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-[640px]"
          >
            <div className="flex items-center gap-2 mb-10">
              <button onClick={() => setMode(null)} className="text-[10px] uppercase tracking-widest text-sub bg-transparent border-none cursor-pointer hover:text-white transition-colors">← Back</button>
              <span className="text-[10px] text-muted">/ {mode === 'file' ? 'Upload File' : mode === 'code' ? 'GitHub Import' : 'Serverless Function'}</span>
            </div>

            {mode === 'file' && (
              <FileDeployForm
                file={file}
                dragging={dragging}
                error={error}
                region={region}
                regionOptions={regionOptions}
                isSubmitting={isSubmitting}
                onSelectFile={setFile}
                onSetDragging={setDragging}
                onRegionChange={setRegion}
                onDeploy={() => void handleDirectDeploy()}
                onCancel={() => {
                  setMode(null);
                  setError(null);
                }}
              />
            )}

            {mode === 'code' && (
              <GitHubDeployForm
                environment={environment}
                region={region}
                regionOptions={regionOptions}
                isSubmitting={isSubmitting}
                error={error}
                onEnvironmentChange={setEnvironment}
                onRegionChange={setRegion}
                onCancel={() => {
                  setMode(null);
                  setError(null);
                }}
                onDeploy={handleGitHubDeploy}
              />
            )}

            {mode === 'function' && (
              <FunctionDeployForm
                code={functionVal}
                error={error}
                region={region}
                regionOptions={regionOptions}
                isSubmitting={isSubmitting}
                onCodeChange={setFunctionVal}
                onRegionChange={setRegion}
                onDeploy={() => void handleDirectDeploy()}
                onCancel={() => {
                  setMode(null);
                  setError(null);
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
