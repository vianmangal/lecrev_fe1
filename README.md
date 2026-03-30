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
The auth service also serves `/api/github/*` for GitHub App repo discovery, binding persistence, and webhook-triggered git deploys.

## Production Build

For a static deploy behind nginx on the same host as the backend:

```bash
cp env.production.example .env.production
npm run build
```

Keep `VITE_LECREV_API_BASE_URL` blank so the built frontend uses same-origin `/v1` requests through nginx.
Set `LECREV_API_KEY`, `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY_PATH`, and `GITHUB_WEBHOOK_SECRET` in the deployed auth env if you want GitHub repo picking and auto-deploy on push.

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
GITHUB_APP_ID="your-github-app-id"
GITHUB_PRIVATE_KEY_PATH="./github-app.private-key.pem"
GITHUB_WEBHOOK_SECRET="replace-this-with-a-long-random-secret"
LECREV_API_TARGET="http://localhost:8080"
LECREV_API_KEY="dev-root-key"
LECREV_PUBLIC_API_URL="http://localhost:8080"
LECREV_DEFAULT_PROJECT_ID="demo"
GITHUB_APP_DB_PATH="./data/github-app.sqlite"
VITE_LECREV_API_BASE_URL=""
VITE_LECREV_API_KEY="dev-root-key"
VITE_LECREV_PROJECT_ID="demo"
```

## GitHub OAuth Setup

Create a GitHub OAuth app and configure these values:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

After that, copy the client ID and client secret into `.env.local`.

## GitHub App Setup

For repo discovery and auto-deploy from push events, configure the GitHub App with:

- Homepage URL: `http://localhost:3000`
- Webhook URL: `http://localhost:3000/api/github/webhooks`
- Webhook secret: match `GITHUB_WEBHOOK_SECRET`
- Repository permissions:
  - Metadata: read-only
  - Contents: read-only
  - Commit statuses: read/write
  - Checks: read/write
  - Deployments: read/write
  - Pull requests: read-only

The frontend deploy screen now lists repositories directly from the GitHub App installation instead of requiring manual `owner/repo` input. After a successful GitHub-backed deploy, the auth service persists an auto-deploy binding so later `push` webhooks can trigger a new control-plane git deploy automatically and update the GitHub commit status.

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
