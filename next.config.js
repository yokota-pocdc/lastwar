/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ステージング環境用のbasePath設定
  // NEXT_PUBLIC_BASE_PATH=/stage で起動するとステージング環境になる
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // basePathが設定されている場合、assetPrefixも同様に設定
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
}

module.exports = nextConfig
