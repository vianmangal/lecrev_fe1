import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';

const defaultAuthOrigin = 'http://localhost:3000';
const rawDbPath = (process.env.BETTER_AUTH_DB_PATH ?? './data/better-auth.sqlite').trim();
const authDbPath = path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(process.cwd(), rawDbPath);
const authDbDir = path.dirname(authDbPath);

if (!fs.existsSync(authDbDir)) {
  fs.mkdirSync(authDbDir, { recursive: true });
}

const configuredOrigin = (process.env.BETTER_AUTH_URL ?? defaultAuthOrigin).trim() || defaultAuthOrigin;
const githubClientId = (process.env.GITHUB_CLIENT_ID ?? '').trim();
const githubClientSecret = (process.env.GITHUB_CLIENT_SECRET ?? '').trim();
const rawTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '').trim();
const trustedOrigins = rawTrustedOrigins
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function toOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const resolvedTrustedOrigins = Array.from(
  new Set(
    [
      configuredOrigin,
      toOrigin(process.env.VITE_BETTER_AUTH_URL ?? ''),
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...trustedOrigins,
    ].filter((value): value is string => Boolean(value)),
  ),
);

export const isGithubAuthConfigured = Boolean(githubClientId && githubClientSecret);

export const auth = betterAuth({
  database: new DatabaseSync(authDbPath),
  baseURL: configuredOrigin,
  basePath: '/api/auth',
  trustedOrigins: resolvedTrustedOrigins,
  secret: (process.env.BETTER_AUTH_SECRET ?? 'replace-this-before-production-with-a-long-random-secret').trim(),
  socialProviders: isGithubAuthConfigured
    ? {
        github: {
          clientId: githubClientId,
          clientSecret: githubClientSecret,
        },
      }
    : {},
});
