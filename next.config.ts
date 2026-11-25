import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
