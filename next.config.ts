import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    /*
     * Board photo hosts are still listed because next/image validates `src`
     * against these even when `unoptimized` is set — but nothing routes through
     * the optimiser any more. See ListingMediaCarousel for why: these files
     * arrive with the brokerage watermark already burned in, and proxying them
     * made a slow CDN into a 500 from our own origin.
     */
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
