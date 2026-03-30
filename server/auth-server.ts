import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { getMigrations } from 'better-auth/db/migration';
import { toNodeHandler } from 'better-auth/node';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const { auth, isGithubAuthConfigured } = await import('./auth');
const { createGitHubAppRouter, isGithubAppConfigured } = await import('./github-app');

const app = express();
const authHandler = toNodeHandler(auth);

const handleAuthRequest = (req: express.Request, res: express.Response) => {
  void authHandler(req, res);
};

app.all('/api/auth', handleAuthRequest);
app.all('/api/auth/*', handleAuthRequest);
app.use('/api/github', createGitHubAppRouter());

app.get('/health/auth', (_req, res) => {
  res.json({
    ok: true,
    githubConfigured: isGithubAuthConfigured,
    githubAppConfigured: isGithubAppConfigured,
  });
});

async function start() {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();

  if (!isGithubAuthConfigured) {
    console.warn('[better-auth] GitHub OAuth is not configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
  }

  const port = Number(process.env.AUTH_PORT ?? '3001');
  app.listen(port, () => {
    console.log(`[better-auth] listening on http://localhost:${port}`);
  });
}

void start().catch((error) => {
  console.error('[better-auth] failed to start', error);
  process.exit(1);
});
