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
    // osc-app proxies the Forms service's paths (lib/app/routes.ts). Next's default gives a proxied answer 30s, and
    // Forms' invoice submit uploads up to two 12MB files to Dropbox and mails them before it answers: a slow day would
    // show crew an error AFTER the invoice went in, and they'd send it again (tested 10/8: 35s → 500 at 30s).
    proxyTimeout: 300_000,
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
