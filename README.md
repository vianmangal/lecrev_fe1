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

Open `http://localhost:3000`. `npm run dev` now starts both the Vite frontend and the Better Auth server. The Vite dev server proxies `/v1` to `http://localhost:8080`, `/api/auth` to the local Better Auth server, and `/api/lecrev` for session-managed tenant provisioning.
The auth service also serves `/api/github/*` for GitHub App repo discovery, binding persistence, and webhook-triggered git deploys.

## Production Build

For a static deploy behind nginx on the same host as the backend:

```bash
cp env.production.example .env.production
npm run build
```

Set `VITE_LECREV_API_BASE_URL` to your public API hostname if the frontend and API are on different origins.
Set `LECREV_POSTGRES_DSN`, `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY_PATH`, and `GITHUB_WEBHOOK_SECRET` in the deployed auth env if you want tenant-scoped GitHub repo picking and auto-deploy on push.

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
LECREV_POSTGRES_DSN="postgres://lecrev:lecrev@localhost:5432/lecrev?sslmode=disable"
LECREV_PUBLIC_API_URL="http://localhost:8080"
GITHUB_APP_DB_PATH="./data/github-app.sqlite"
VITE_LECREV_API_BASE_URL=""
```

## GitHub OAuth Setup

Create a GitHub OAuth app and configure these values:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

After that, copy the client ID and client secret into `.env.local`.
The sign-in flow should request `read:user`, `user:email`, `read:org`, and `repo` so the repo picker can be filtered to the signed-in user’s accessible GitHub App installations and repositories.

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

The frontend deploy screen now lists repositories only from the signed-in user’s accessible GitHub App installations instead of a global app installation view. After a successful GitHub-backed deploy, the auth service persists a user-scoped auto-deploy binding so later `push` webhooks can trigger a new control-plane git deploy automatically and update the GitHub commit status.

## What the Dashboard Does

- Loads regions, projects, and deployment summaries from the backend APIs.
- Provisions a tenant-scoped control-plane API key and default project for the signed-in GitHub user.
- Creates a new function version through `POST /v1/projects/{project}/functions`.
- Polls build and function status until the version is ready.
- Auto-invokes the function through `POST /v1/functions/{versionId}/invoke`.
- Fetches archived build logs, deployment logs, and job output once the run completes.

## Current Demo Scope

- Runtime: `node22`
- Regions: `ap-south-1`, `ap-south-2`, `ap-southeast-1`
- Frontend auth now uses Better Auth with the GitHub social provider.
- The browser no longer uses a shared admin API key or a shared `demo` project by default.
