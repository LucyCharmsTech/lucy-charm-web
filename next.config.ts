import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'trreb-image.ampre.ca',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ftrreb-image.ampre.ca',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
