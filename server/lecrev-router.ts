import express from 'express';
import { getAuthenticatedGitHubAccessToken, getAuthenticatedSessionUser } from './auth-session';
import { getGitHubViewer } from './github-app';
import { ensureLecrevUserConnection } from './lecrev-tenant';

export function createLecrevRouter() {
  const router = express.Router();

  router.get('/connection', async (req, res) => {
    const [user, tokenPayload] = await Promise.all([
      getAuthenticatedSessionUser(req),
      getAuthenticatedGitHubAccessToken(req),
    ]);

    if (!user?.id) {
      res.status(401).json({ error: 'Sign in with GitHub to access your Lecrev workspace.' });
      return;
    }
    if (!tokenPayload?.accessToken) {
      res.status(403).json({ error: 'Your GitHub session is missing repository access. Sign out and sign in again to refresh your GitHub consent.' });
      return;
    }

    try {
      const viewer = await getGitHubViewer(tokenPayload.accessToken);
      if (!viewer.id || !viewer.login) {
        res.status(502).json({ error: 'Unable to resolve the signed-in GitHub account.' });
        return;
      }

      const connection = await ensureLecrevUserConnection(user.id, {
        id: String(viewer.id),
        login: viewer.login,
      });

      res.json({
        managed: true,
        connection: {
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey,
          projectId: connection.projectId,
        },
        tenantId: connection.tenantId,
        projectName: connection.projectName,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to provision the Lecrev tenant connection.';
      res.status(502).json({ error: message });
    }
  });

  return router;
}
