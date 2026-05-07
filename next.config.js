/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};
module.exports = nextConfig; 
module.exports = {
  ...nextConfig,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'myanimelist.net',
        pathname: '/**',
      },
      { hostname: 's4.anilist.co' },
      { hostname: 'cdn.myanimelist.net' },
    ],
  },
};
