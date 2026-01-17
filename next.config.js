/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Fix Next workspace root inference issues on servers with nested repos
  outputFileTracingRoot: __dirname,

  eslint: {
    // ✅ Don’t fail builds because of ESLint/type rules
    ignoreDuringBuilds: true,
  },

  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
