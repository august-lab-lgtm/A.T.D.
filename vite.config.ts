import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cameraProxyTarget = env.VITE_CAMERA_PROXY_TARGET || env.CAMERA_PROXY_TARGET;

  return defineConfig({
    plugins: [react()],
    server: {
      port: 4173,
      host: "localhost",
      https: true,
      proxy: cameraProxyTarget
        ? {
            "/api/camera": {
              target: cameraProxyTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/api\/camera/, ""),
            },
          }
        : undefined,
    },
  });
};
