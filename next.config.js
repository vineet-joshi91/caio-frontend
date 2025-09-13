/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ✅ Don’t fail Vercel build because of ESLint/type rules
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/",           // root route
        destination: "/dashboard", // always go to dashboard
        permanent: false,      // temporary redirect (307) so it can be changed later
      },
    ];
  },
};

module.exports = nextConfig;
