import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('upsertGitHubRepoBinding inserts a new binding with env vars', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lecrev-github-bindings-'));
  process.env.GITHUB_APP_DB_PATH = path.join(tempDir, 'github-app.sqlite');

  const store = await import(`${pathToFileURL(path.resolve(process.cwd(), 'server/github-deployments-store.ts')).href}?t=${Date.now()}`);

  const binding = store.upsertGitHubRepoBinding({
    userId: 'user-1',
    tenantId: 'tenant-1',
    installationId: 120332848,
    owner: 'theg1239',
    repo: 'examcooker-paper-counter',
    repoFullName: 'theg1239/examcooker-paper-counter',
    gitUrl: 'https://github.com/theg1239/examcooker-paper-counter.git',
    gitRef: 'master',
    entrypoint: 'server/index.js',
    envVars: {
      DATABASE_URL: 'postgres://example',
    },
    projectId: 'gh-project-52027622',
    functionName: 'gdsc-official-website',
    environment: 'production',
    region: 'ap-south-1',
    autoDeploy: true,
  });

  assert.equal(binding.repoFullName, 'theg1239/examcooker-paper-counter');
  assert.equal(binding.envVars.DATABASE_URL, 'postgres://example');
  assert.equal(binding.projectId, 'gh-project-52027622');
});
