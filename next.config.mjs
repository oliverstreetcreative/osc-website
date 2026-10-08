/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // instrumentation.ts: client-site schema + book sync at boot (staging only).
  experimental: {
    instrumentationHook: true,
  },
  async rewrites() {
    const crewPortalUrl = process.env.CREW_PORTAL_URL;
    if (!crewPortalUrl) return [];
    return [
      {
        source: '/crew/:path*',
        destination: `${crewPortalUrl}/crew/:path*`,
      },
    ];
  },
}

export default nextConfig
