import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // Only use static export for production Cloudflare builds.
  // In dev, we need server-side API routes to function.
  ...(!isDev && { output: 'export' }),
  
  // In production (Cloudflare), all APIs are handled by the `functions/` directory.
  // We use `route.ts` strictly for local development APIs. By excluding '.ts' from 
  // pageExtensions during production builds, Next.js completely ignores `src/app/api/.../route.ts`
  // and avoids the static-export errors on dynamic server routes.
  // We MUST keep 'js' and 'jsx' so Next.js internal files continue to resolve.
  pageExtensions: isDev ? ['ts', 'tsx', 'js', 'jsx'] : ['tsx', 'js', 'jsx'],
  
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
