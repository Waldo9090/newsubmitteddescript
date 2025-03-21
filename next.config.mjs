/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['aisummarizer-descript.com'],
  },
  env: {
    ASSEMBLY_AI_API_KEY: process.env.ASSEMBLY_AI_API_KEY,
    NEXT_PUBLIC_ASSEMBLY_AI_API_KEY: process.env.NEXT_PUBLIC_ASSEMBLY_AI_API_KEY || '',
    ATTENDEE_API_KEY: process.env.ATTENDEE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'https://aisummarizer-descript.com'
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  // Simplified webpack configuration
  webpack: (config, { isServer }) => {
    // Add polyfills for node modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      encoding: false
    };

    return config;
  },
  transpilePackages: ['undici', 'firebase', '@firebase/auth'],
  // Disable React strict mode in production to avoid double-rendering issues
  reactStrictMode: process.env.NODE_ENV === 'development',
  // Improve production builds
  productionBrowserSourceMaps: false,
  swcMinify: true,
  poweredByHeader: false,
  // Configure distDir to avoid conflicts
  distDir: '.next',
  // Clean distDir before building
  cleanDistDir: true,
}

export default nextConfig
