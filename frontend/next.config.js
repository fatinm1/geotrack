/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['react-globe.gl', 'globe.gl', 'three'],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-globe.gl': require.resolve('react-globe.gl'),
    };
    return config;
  },
};

module.exports = nextConfig;
