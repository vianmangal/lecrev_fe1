import express from 'express';
import { auth } from './auth';

export interface AuthenticatedSessionUser {
  id: string;
  email?: string;
  name?: string;
  image?: string;
}

export interface GitHubAccessTokenPayload {
  accessToken: string;
  scopes: string[];
}

function requestHeaders(req: express.Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      headers[key] = value.join(', ');
    }
  }
  return headers;
}

export async function getAuthenticatedSessionUser(req: express.Request): Promise<AuthenticatedSessionUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: requestHeaders(req),
    }) as { user?: AuthenticatedSessionUser | null } | null;
    if (!session?.user?.id) {
      return null;
    }
    return session.user;
  } catch {
    return null;
  }
}

export async function getAuthenticatedGitHubAccessToken(req: express.Request): Promise<GitHubAccessTokenPayload | null> {
  try {
    const tokenPayload = await auth.api.getAccessToken({
      headers: requestHeaders(req),
      body: {
        providerId: 'github',
      },
    }) as { accessToken?: string; scopes?: string[] } | null;

    if (!tokenPayload?.accessToken) {
      return null;
    }

    return {
      accessToken: tokenPayload.accessToken,
      scopes: tokenPayload.scopes ?? [],
    };
  } catch {
    return null;
  }
}
