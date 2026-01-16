/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Node.js runtime (not edge) for file uploads and embeddings
  // as specified in TECH_STACK.md Section 3.1
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  transpilePackages: ['@verbatim/contracts'],
};

module.exports = nextConfig;
