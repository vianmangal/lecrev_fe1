import { createAuthClient } from 'better-auth/react';

const configuredBaseURL = (import.meta.env.VITE_BETTER_AUTH_URL ?? '').trim();
const fallbackBaseURL =
  typeof window === 'undefined'
    ? 'http://localhost:3000/api/auth'
    : `${window.location.origin}/api/auth`;

export const authClient = createAuthClient({
  baseURL: configuredBaseURL || fallbackBaseURL,
});
