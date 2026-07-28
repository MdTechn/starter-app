import path from 'path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

/** Charge .env à la racine du monorepo (variables centralisées). */
const monorepoRoot = path.join(__dirname, '..');
loadEnvConfig(monorepoRoot);

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@saas-starter/shared'],
  async rewrites() {
    return [
      {
        // Proxy API métier vers NestJS, sauf /api/auth (NextAuth)
        source: '/api/:path((?!auth).*)',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
