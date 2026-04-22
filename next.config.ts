import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // // 允许局域网设备访问开发服务器（手机/其他电脑扫码测试）
  allowedDevOrigins: [
    "192.168.4.72",
    "192.168.4.*",
    "10.30.1.*",
    "192.168.*.*",
    "10.*.*.*",
  ],
  // xlsx 内部使用 Node.js fs，不能被 Turbopack 打包，需作为外部包直接引用
  // Next.js 文档明确：serverExternalPackages 与 require() 配合使用
  serverExternalPackages: ["xlsx"],
  // 确保 Excel 题库文件在生产构建的文件追踪中被包含（standalone 模式必需）
  outputFileTracingIncludes: {
    "/api/training/**": ["./src/data/tables/**"],
  },
};

export default nextConfig;
