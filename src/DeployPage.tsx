import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ApiConnection, DeployRequestInput, LiveDeploymentRecord, ProjectRecord } from './api';
import { DeployMode, DeployModePicker } from './components/deploy/DeployModePicker';
import { FileDeployForm } from './components/deploy/FileDeployForm';
import { FunctionDeployForm } from './components/deploy/FunctionDeployForm';
import { GitHubDeployForm, GitHubDeploySubmission } from './components/deploy/GitHubDeployForm';
import { DeploySuccess } from './components/deploy/DeploySuccess';
import { CyanBtn, GhostBtn, SelectInput, TextInput } from './components/UI';

interface DeployPageProps {
  onBack: () => void;
  onDeploy: (request: DeployRequestInput) => Promise<{ versionId: string; buildJobId?: string }>;
  onGitHubDeploy: (input: {
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
  }) => Promise<{ versionId: string; buildJobId?: string }>;
  projects: ProjectRecord[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: { id?: string; name: string }) => Promise<ProjectRecord>;
  regionOptions: string[];
  liveDeployments: LiveDeploymentRecord[];
  connection: ApiConnection;
}

const DEFAULT_HANDLER = "export async function handler(event, context) {\n  return { ok: true, echo: event, region: context.region, hostId: context.hostId };\n}\n";

export const DeployPage: React.FC<DeployPageProps> = ({
  onBack,
  onDeploy,
  onGitHubDeploy,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  regionOptions,
  liveDeployments,
  connection,
}) => {
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
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

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
    const cleanedProject = selectedProjectId.trim();
    if (!cleanedProject) {
      throw new Error('Create or select a project before deploying.');
    }
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
      const cleanedProject = selectedProjectId.trim();
      if (!cleanedProject) {
        throw new Error('Create or select a project before deploying.');
      }
      const info = await onGitHubDeploy({
        installationId: submission.installationId,
        owner: submission.owner,
        repo: submission.repo,
        repoFullName: submission.repoFullName,
        gitUrl: submission.gitUrl,
        gitRef: submission.gitRef,
        entrypoint: submission.entrypoint,
        projectId: cleanedProject,
        functionName: sanitizeName(submission.functionName || submission.repoFullName.replace(/\//g, '-')),
        environment: environment.toLowerCase() as 'production' | 'staging' | 'preview',
        region: selectedRegion,
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

  const handleCreateProject = async () => {
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setError('Enter a project name first.');
      return;
    }
    setError(null);
    setIsCreatingProject(true);
    try {
      const created = await onCreateProject({ name: trimmedName });
      onSelectProject(created.id);
      setProjectName('');
      setCreatingProject(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const projectOptions = projects.map((project) => project.id);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

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

      <div className="max-w-[640px] border border-border bg-surface/40 p-5 mb-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-1">Project</p>
            <p className="text-[12px] text-muted">
              {selectedProject ? `Deploying into ${selectedProject.name}` : 'Create a project or choose an existing one before deploying.'}
            </p>
          </div>
          <GhostBtn
            onClick={() => {
              setCreatingProject((current) => !current);
              setProjectName('');
            }}
            small
          >
            {creatingProject ? 'Close' : 'New Project'}
          </GhostBtn>
        </div>

        {projectOptions.length > 0 ? (
          <div className="mb-4">
            <SelectInput
              label="Target Project"
              options={projectOptions}
              value={selectedProjectId || projectOptions[0]}
              onChange={onSelectProject}
            />
            {selectedProject && (
              <p className="text-[11px] text-muted mt-2">Selected: {selectedProject.name}</p>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-amber-300 mb-4">No projects exist for this tenant yet.</p>
        )}

        {creatingProject && (
          <div className="border border-border p-4 bg-black/20">
            <div className="mb-4">
              <TextInput
                label="Project Name"
                placeholder="my-next-project"
                value={projectName}
                onChange={setProjectName}
              />
            </div>
            <div className="flex items-center gap-3">
              <CyanBtn onClick={() => void handleCreateProject()} disabled={isCreatingProject}>
                {isCreatingProject ? 'Creating…' : 'Create Project'}
              </CyanBtn>
              <GhostBtn
                onClick={() => {
                  setCreatingProject(false);
                  setProjectName('');
                }}
                disabled={isCreatingProject}
              >
                Cancel
              </GhostBtn>
            </div>
          </div>
        )}
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
