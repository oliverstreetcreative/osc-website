/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
