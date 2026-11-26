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
        // The landing page embeds /qr_demo.html in an iframe, so that one file may be framed by this origin only.
        source: '/((?!qr_demo\\.html).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        source: '/qr_demo.html',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/member.html', destination: '/', permanent: true },
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
