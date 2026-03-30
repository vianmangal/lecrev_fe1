import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GhostBtn, CyanBtn, SelectInput, TextInput } from './components/UI';
import { Upload, Code, Terminal, CheckCircle2 } from 'lucide-react';
import { DeployRequestInput } from './api';

interface DeployPageProps {
  onBack: () => void;
  onDeploy: (request: DeployRequestInput) => Promise<{ versionId: string; buildJobId?: string }>;
  defaultProjectId: string;
  regionOptions: string[];
}

const DEFAULT_HANDLER = "export async function handler(event, context) {\n  return { ok: true, echo: event, region: context.region, hostId: context.hostId };\n}\n";

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

interface GitHubFileEntry {
  path: string;
  sha: string;
  url: string;
  type: 'blob' | 'tree';
}

// GitHub App Configuration
const GITHUB_APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG || 'your_github_app_slug_here'; // Replace with your actual App slug
const GITHUB_APP_REDIRECT_URI = window.location.origin + '/auth/github/callback'; // Your callback URL

// GitHub App Installation URL
const GITHUB_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;

const textToBase64 = (text: string) => window.btoa(unescape(encodeURIComponent(text)));
const base64ToText = (base64: string) => decodeURIComponent(escape(window.atob(base64)));

const parseGitHubRepo = (input: string): { owner: string; repo: string } | null => {
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
};

// GitHub App Installation Functions
const initiateGitHubAuth = () => {
  const state = Math.random().toString(36).substring(7);
  sessionStorage.setItem('github_oauth_state', state);

  const params = new URLSearchParams({
    state: state,
  });

  window.location.href = `${GITHUB_INSTALL_URL}?${params.toString()}`;
};

const handleGitHubCallback = async (installationId: string, state: string) => {
  const storedState = sessionStorage.getItem('github_oauth_state');
  if (state !== storedState) {
    throw new Error('Invalid OAuth state');
  }

  // Call backend to get installation access token
  const response = await fetch('http://localhost:3001/api/github/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      installationId: installationId,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to get access token');
  }

  return data.token;
};

const getGitHubUser = async (token: string) => {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
};

export const DeployPage: React.FC<DeployPageProps> = ({ onBack, onDeploy, defaultProjectId, regionOptions }) => {
  const [mode, setMode] = useState<'file' | 'code' | 'function' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [codeVal, setCodeVal] = useState(DEFAULT_HANDLER);
  const [functionVal, setFunctionVal] = useState(DEFAULT_HANDLER);
  const [environment, setEnvironment] = useState<'Production' | 'Staging' | 'Preview'>('Production');
  const [region, setRegion] = useState(regionOptions[0] || 'ap-south-1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployInfo, setDeployInfo] = useState<{ versionId: string; buildJobId?: string } | null>(null);
  const [deployed, setDeployed] = useState(false);

  const [githubRepo, setGithubRepo] = useState('');
  const [githubError, setGithubError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [githubAccessToken, setGithubAccessToken] = useState<string>('');
  const [isGitHubAuthorized, setIsGitHubAuthorized] = useState(false);
  const [githubUser, setGithubUser] = useState<any>(null);
  const [githubInstallationId, setGithubInstallationId] = useState<string>('');

  const fileRef = useRef<HTMLInputElement>(null);

  const getGitHubUser = async (token: string) => {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return response.json();
  };

  useEffect(() => {
    if (regionOptions.length === 0) {
      setRegion('ap-south-1');
      return;
    }
    setRegion((current) => (regionOptions.includes(current) ? current : regionOptions[0]));
  }, [regionOptions]);

  // Handle GitHub App installation callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const installationId = urlParams.get('installation_id');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setGithubError(`GitHub auth failed: ${error}`);
      return;
    }

    if (installationId && state) {
      handleGitHubCallback(installationId, state)
        .then(async (token) => {
          setGithubAccessToken(token);
          setGithubInstallationId(installationId);
          setIsGitHubAuthorized(true);
          // For GitHub Apps, we don't get user info the same way, but we can set a placeholder
          setGithubUser({ login: 'GitHub App Authorized' });
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          setGithubError(err.message);
        });
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const validateAndDeploy = async () => {
    setGithubError(null);
    setIsAuthenticating(true);

    try {
      const parsed = parseGitHubRepo(githubRepo);
      if (!parsed) {
        throw new Error('Invalid repo format. Use owner/repo or GitHub URL.');
      }

      if (!githubInstallationId) {
        throw new Error('Please authorize with GitHub first.');
      }

      const repoRes = await fetch(`http://localhost:3001/api/github/repos/${parsed.owner}/${parsed.repo}?installationId=${githubInstallationId}`);

      if (repoRes.status === 401 || repoRes.status === 403) {
        throw new Error('Invalid token or no access to this repository.');
      }
      if (repoRes.status === 404) {
        throw new Error('Repository not found.');
      }
      if (!repoRes.ok) {
        throw new Error(`GitHub error: ${repoRes.status}`);
      }

      const repoData = await repoRes.json();
      const branch = repoData.default_branch || 'main';

      const treeRes = await fetch(
        `http://localhost:3001/api/github/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?installationId=${githubInstallationId}&recursive=1`
      );

      if (!treeRes.ok) {
        throw new Error('Unable to access repository contents.');
      }

      const treeData = await treeRes.json();
      const jsFiles = (treeData.tree || []).filter(
        (item: any) => item.type === 'blob' && /\.(js|mjs|ts|tsx)$/.test(item.path)
      );

      if (jsFiles.length === 0) {
        throw new Error('No JavaScript files found in repository.');
      }

      const mainFile = jsFiles.find((f: any) => /^(index|main|handler)\.(js|mjs|ts|tsx)$/.test(f.path)) || jsFiles[0];
      const contentRes = await fetch(
        `http://localhost:3001/api/github/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(mainFile.path)}?installationId=${githubInstallationId}&ref=${branch}`
      );

      if (!contentRes.ok) {
        throw new Error('Unable to read main file.');
      }

      const contentData = await contentRes.json();
      const fileContent = base64ToText(contentData.content.replace(/\n/g, ''));

      await handleGitHubDeploy(fileContent, `${parsed.owner}/${parsed.repo}`);
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Authentication failed.');
      setIsAuthenticating(false);
    }
  };

  const handleGitHubDeploy = async (fileContent: string, repoName: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const selectedRegion = region.trim() || regionOptions[0] || 'ap-south-1';
      const cleanedProject = defaultProjectId.trim() || 'default-project';
      const cleanedName = repoName.replace(/\//g, '-').toLowerCase();

      const request: DeployRequestInput = {
        projectId: cleanedProject,
        name: cleanedName,
        environment,
        region: selectedRegion,
        entrypoint: 'index.mjs',
        inlineFiles: {
          'index.mjs': fileContent,
        },
      };

      const info = await onDeploy(request);
      setDeployInfo(info);
      setDeployed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed.');
    } finally {
      setIsSubmitting(false);
      setIsAuthenticating(false);
    }
  };

  const sanitizeName = (value: string): string => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || 'ui-function';
  };

  const buildRequest = async (): Promise<DeployRequestInput> => {
    if (!mode) {
      throw new Error('Select a deployment mode first.');
    }
    const selectedRegion = region.trim() || regionOptions[0] || 'ap-south-1';
    const cleanedProject = defaultProjectId.trim() || 'default-project';
    const repoName = githubRepo ? githubRepo.split('/').pop()?.replace(/\.git$/, '') : 'app';
    const cleanedName = sanitizeName(repoName || 'ui-function');

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

    if (mode === 'code') {
      return {
        projectId: cleanedProject,
        name: cleanedName,
        environment,
        region: selectedRegion,
        entrypoint: 'index.mjs',
        inlineFiles: {
          'index.mjs': codeVal,
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

  const handleDeploy = async () => {
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

  const canSubmit = mode !== null && !(mode === 'file' && !file) && !isSubmitting;

  if (deployed) return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 px-4"
    >
      <div className="w-14 h-14 rounded-full border border-cyan-primary flex items-center justify-center text-cyan-primary">
        <CheckCircle2 size={32} />
      </div>
      <p className="text-sm uppercase tracking-[0.1em]">Deployment Queued</p>
      <p className="text-[11px] text-sub">{deployInfo?.buildJobId || deployInfo?.versionId || 'deployment'}</p>
      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
        <GhostBtn className="w-full sm:w-auto" onClick={() => { setDeployed(false); setMode(null); setFile(null); setDeployInfo(null); setError(null); }}>New Deployment</GhostBtn>
        <CyanBtn className="w-full sm:w-auto" onClick={onBack}>View Deployments →</CyanBtn>
      </div>
    </motion.div>
  );

  const OPTIONS = [
    {
      id: "file" as const,
      label: "Upload File",
      icon: <Upload size={32} strokeWidth={1} />,
      desc: "Upload a ZIP, tarball, or single file to deploy directly to your project."
    },
    {
      id: "code" as const,
      label: "GitHub Deploy",
      icon: <Code size={32} strokeWidth={1} />,
      desc: "Paste a GitHub repo link and token to deploy your code instantly."
    },
    {
      id: "function" as const,
      label: "Function",
      icon: <Terminal size={32} strokeWidth={1} />,
      desc: "Deploy a serverless function with an HTTP trigger, cron schedule, or event source."
    },
  ];

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
          <motion.div
            key="options"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-[2px] mb-12 bg-border"
          >
            {OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className="group bg-black border border-transparent hover:border-border-md p-8 cursor-pointer text-left transition-all duration-150 flex flex-col gap-4"
              >
                <div className="text-sub group-hover:text-cyan-primary transition-colors duration-150">{opt.icon}</div>
                <div>
                  <p className="text-[12px] mb-2 text-white font-medium">{opt.label}</p>
                  <p className="text-[11px] text-sub leading-relaxed">{opt.desc}</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted group-hover:text-cyan-primary mt-auto transition-colors">
                  Select →
                </span>
              </button>
            ))}
          </motion.div>
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
              <span className="text-[10px] text-muted">/ {mode === 'file' ? 'Upload File' : mode === 'code' ? 'Code Editor' : 'Serverless Function'}</span>
            </div>

            {mode === "file" && (
              <>
                <p className="text-[12px] text-sub mb-6">Select a file to deploy to your project.</p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`
                    border border-dashed p-12 text-center cursor-pointer mb-8 transition-all duration-150 rounded
                    ${dragging ? "border-cyan-primary bg-cyan-primary/5" : file ? "border-cyan-primary/40 bg-surface" : "border-border-md bg-surface hover:border-sub"}
                  `}
                >
                  <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  {file ? (
                    <div>
                      <p className="text-[12px] text-cyan-primary mb-1">{file.name}</p>
                      <p className="text-[10px] text-sub">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[12px] mb-1">Drag & drop your file here</p>
                      <p className="text-[10px] text-sub">or click to browse</p>
                      <p className="text-[9px] text-muted mt-2">ZIP, TAR, JS, PY, GO supported</p>
                    </div>
                  )}
                </div>
                <div className="mb-8">
                  <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={setRegion} />
                </div>

                {error && (
                  <div className="mb-8 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400 rounded">{error}</div>
                )}

                <div className="flex gap-3">
                  <CyanBtn onClick={handleDeploy} disabled={!file || isSubmitting}>
                    {isSubmitting ? 'Deploying...' : 'Deploy →'}
                  </CyanBtn>
                  <GhostBtn onClick={() => { setMode(null); setError(null); }} disabled={isSubmitting}>
                    Cancel
                  </GhostBtn>
                </div>
              </>
            )}

            {mode === "code" && (
              <div className="max-w-[600px]">
                <p className="text-[12px] text-sub mb-8">Connect your GitHub account and provide repository details to deploy your code.</p>

                {!isGitHubAuthorized ? (
                  <div className="mb-8">
                    <div className="border border-border bg-surface p-6 rounded text-center">
                      <div className="text-2xl mb-4">🐙</div>
                      <p className="text-[12px] text-white mb-2">GitHub Authorization Required</p>
                      <p className="text-[10px] text-sub mb-4">Authorize access to your repositories to deploy code directly from GitHub.</p>
                      <CyanBtn onClick={initiateGitHubAuth}>
                        Authorize with GitHub
                      </CyanBtn>
                    </div>
                  </div>
                ) : (
                  <div className="mb-8">
                    <div className="border border-green-500/30 bg-green-500/5 p-4 rounded mb-6">
                      <div className="flex items-center gap-3">
                        <div className="text-green-400">✓</div>
                        <div>
                          <p className="text-[11px] text-green-400">Authorized as {githubUser?.login}</p>
                          <p className="text-[9px] text-sub">You can now deploy from your repositories</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <TextInput
                    label="Repository"
                    value={githubRepo}
                    onChange={setGithubRepo}
                    placeholder="owner/repo"
                  />
                  <p className="text-[10px] text-muted mt-2">Example: myusername/myrepo</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                  <SelectInput label="Environment" options={["Production", "Staging", "Preview"]} value={environment} onChange={(value) => setEnvironment(value as 'Production' | 'Staging' | 'Preview')} />
                  <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={setRegion} />
                </div>

                {githubError && (
                  <div className="mb-8 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400 rounded">{githubError}</div>
                )}

                <div className="flex gap-3">
                  <CyanBtn onClick={validateAndDeploy} disabled={isAuthenticating || isSubmitting || !githubRepo.trim() || !isGitHubAuthorized}>
                    {isAuthenticating || isSubmitting ? 'Deploying...' : 'Deploy →'}
                  </CyanBtn>
                  <GhostBtn onClick={() => { setMode(null); setGithubError(null); setGithubRepo(''); }} disabled={isAuthenticating || isSubmitting}>
                    Cancel
                  </GhostBtn>
                </div>
              </div>
            )}

            {mode === "function" && (
              <div className="max-w-[600px]">
                <p className="text-[12px] text-sub mb-8">Configure your serverless function settings and write your handler code.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                  <SelectInput label="Runtime" options={["node22"]} />
                  <SelectInput label="Region" options={regionOptions.length ? regionOptions : ['ap-south-1']} value={region} onChange={setRegion} />
                </div>

                <div className="mb-8">
                  <label className="text-[10px] uppercase tracking-widest text-sub block mb-3">Handler Code</label>
                  <textarea
                    value={functionVal}
                    onChange={(e) => setFunctionVal(e.target.value)}
                    spellCheck={false}
                    placeholder="export async function handler(event, context) {\n  return { ok: true };\n}"
                    className="w-full h-[280px] p-4 bg-surface border border-border text-[11px] font-mono text-white focus:outline focus:outline-1 focus:outline-cyan-primary/50 transition-colors resize-none"
                  />
                  <p className="text-[10px] text-muted mt-2">Node.js 22 runtime with HTTP trigger</p>
                </div>

                {error && (
                  <div className="mb-8 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[11px] text-red-400 rounded">{error}</div>
                )}

                <div className="flex gap-3">
                  <CyanBtn onClick={handleDeploy} disabled={!functionVal || isSubmitting}>
                    {isSubmitting ? 'Deploying...' : 'Deploy →'}
                  </CyanBtn>
                  <GhostBtn onClick={() => { setMode(null); setError(null); }} disabled={isSubmitting}>
                    Cancel
                  </GhostBtn>
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
