/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  /** Optional: set CORS_ORIGIN (e.g. http://localhost:3000) for cross-origin API access in local dev. */
  async headers() {
    const origin = process.env.CORS_ORIGIN;
    if (!origin) return [];
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: origin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
