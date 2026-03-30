const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load GitHub App private key
const privateKey = fs.readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH, 'utf8');

// Generate JWT for GitHub App
function generateJWT() {
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // 10 minutes
    iss: process.env.GITHUB_APP_ID
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

// Get installation access token
async function getInstallationToken(installationId) {
  const jwtToken = generateJWT();

  try {
    const response = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    return response.data.token;
  } catch (error) {
    console.error('Error getting installation token:', error.response?.data || error.message);
    throw error;
  }
}

// API endpoint to get installation token
app.post('/api/github/token', async (req, res) => {
  try {
    const { installationId } = req.body;

    if (!installationId) {
      return res.status(400).json({ error: 'Installation ID is required' });
    }

    const token = await getInstallationToken(installationId);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get installation token' });
  }
});

// API endpoint to get repository info
app.get('/api/github/repos/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { installationId } = req.query;

    if (!installationId) {
      return res.status(400).json({ error: 'Installation ID is required' });
    }

    const token = await getInstallationToken(installationId);

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching repo info:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch repository info' });
  }
});

// API endpoint to get repository tree
app.get('/api/github/repos/:owner/:repo/git/trees/:branch', async (req, res) => {
  try {
    const { owner, repo, branch } = req.params;
    const { installationId, recursive } = req.query;

    if (!installationId) {
      return res.status(400).json({ error: 'Installation ID is required' });
    }

    const token = await getInstallationToken(installationId);

    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}${recursive ? '?recursive=1' : ''}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching repo tree:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch repository tree' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});