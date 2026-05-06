const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this project so Next.js loads .env.local
  // from here rather than from a parent directory that happens to contain
  // a stray package-lock.json.
  outputFileTracingRoot: path.join(__dirname),
  // Produce a self-contained server bundle suitable for a slim Docker image
  // (App Runner / Fly / Render). Static assets read from disk at runtime
  // (registry/, sample_codebase/, semgrep/, scripts/) are still copied
  // explicitly in the Dockerfile because they are not part of the Next.js
  // module graph.
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  serverExternalPackages: ['shiki'],
};

module.exports = nextConfig;
