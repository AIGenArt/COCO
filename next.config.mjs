/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-src 'self' https://*.e2b.dev https://*.e2b-staging.dev;"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
