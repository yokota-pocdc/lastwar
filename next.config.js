/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ビルド時のLintチェックをスキップ
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ビルド時の型チェックをスキップ
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
