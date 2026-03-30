# LecRev Backend

Backend server for handling GitHub App authentication and API calls.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your GitHub App details:
   - `GITHUB_APP_ID`: Your GitHub App ID
   - `GITHUB_PRIVATE_KEY_PATH`: Path to your downloaded private key file (e.g., `./private-key.pem`)

4. Place your GitHub App private key file in the backend directory.

## Running the Server

For development:

```bash
npm run dev
```

For production:

```bash
npm start
```

The server will run on `http://localhost:3001` by default.

## API Endpoints

- `POST /api/github/token` - Get installation access token
- `GET /api/github/repos/:owner/:repo/contents/:path?` - Fetch repository contents
- `GET /api/health` - Health check

## Security Notes

- Never commit the private key file to version control
- Keep the `.env` file secure and don't commit it
- The private key is used server-side only for JWT generation
