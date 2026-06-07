import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Permite invocar Server Actions detrás de proxies de desarrollo
      // (GitHub Codespaces / Gitpod reescriben el host y disparan el
      // chequeo CSRF de Next). En producción el dominio propio es same-origin.
      allowedOrigins: [
        "localhost:3000",
        "*.app.github.dev",
        "*.gitpod.io",
      ],
    },
  },
};

export default nextConfig;
