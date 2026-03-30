# Lecrev Frontend

This dashboard is wired to the Lecrev control plane and the async function lifecycle described in `FUNCTION_LIFECYCLE.md`.

## Quick Demo

Run the backend first in the backend repo:

```bash
cd /Users/ishaan/eeeverc
go run ./cmd/lecrev devstack
```

In a second terminal, run the frontend here:

```bash
cd /Users/ishaan/frontend-eeverc/lecrev_fe1
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. `npm run dev` now starts both the Vite frontend and the Better Auth server. The Vite dev server proxies `/v1` to `http://localhost:8080` and `/api/auth` to the local Better Auth server by default.

## Production Build

For a static deploy behind nginx on the same host as the backend:

```bash
cp env.production.example .env.production
npm run build
```

Keep `VITE_LECREV_API_BASE_URL` blank so the built frontend uses same-origin `/v1` requests through nginx.

## Local Environment

Use these defaults in `.env.local` for the fastest local setup:

```bash
AUTH_PORT="3001"
BETTER_AUTH_URL="http://localhost:3000"
VITE_BETTER_AUTH_URL="http://localhost:3000/api/auth"
BETTER_AUTH_SECRET="replace-this-with-a-long-random-secret"
BETTER_AUTH_DB_PATH="./data/better-auth.sqlite"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
LECREV_API_TARGET="http://localhost:8080"
VITE_LECREV_API_BASE_URL=""
VITE_LECREV_API_KEY="dev-root-key"
VITE_LECREV_PROJECT_ID="demo"
```

## GitHub OAuth Setup

Create a GitHub OAuth app and configure these values:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

After that, copy the client ID and client secret into `.env.local`.

## What the Dashboard Does

- Loads regions, projects, and deployment summaries from the backend APIs.
- Creates a new function version through `POST /v1/projects/{project}/functions`.
- Polls build and function status until the version is ready.
- Auto-invokes the function through `POST /v1/functions/{versionId}/invoke`.
- Fetches archived build logs, deployment logs, and job output once the run completes.

## Current Demo Scope

- Runtime: `node22`
- Regions: `ap-south-1`, `ap-south-2`, `ap-southeast-1`
- Frontend auth now uses Better Auth with the GitHub social provider.
- The control-plane connection form still uses the existing `X-API-Key` integration for backend API access.
