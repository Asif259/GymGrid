import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/member.html', destination: '/member', permanent: true },
      { source: '/join.html', destination: '/join', permanent: true },
      { source: '/desk.html', destination: '/desk', permanent: true },
      { source: '/desk-qr.html', destination: '/desk-qr', permanent: true },
      { source: '/receipt.html', destination: '/receipt', permanent: true },
      { source: '/welcome.html', destination: '/welcome', permanent: true },
      { source: '/design-preview.html', destination: '/preview', permanent: true },
    ];
  },
};

export default nextConfig;
