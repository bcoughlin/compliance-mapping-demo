const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this project so Next.js loads .env.local
  // from here rather than from a parent directory that happens to contain
  // a stray package-lock.json.
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  serverExternalPackages: ['shiki'],
};

module.exports = nextConfig;
