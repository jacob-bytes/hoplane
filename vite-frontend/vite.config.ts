import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // No service worker for the online demo.
      disable: process.env.VITE_DEMO === "true",
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Hoplane",
        short_name: "Hoplane",
        description: "Hoplane forwarding management panel",
        theme_color: "#2563eb",
        background_color: "#f6f7fb",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  // The online demo is served from the docs site (VITE_BASE=/hoplane/demo/).
  base: process.env.VITE_BASE || "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // rolldown-vite splits vendors through advancedChunks; keeping React,
        // Radix and the chart stack apart lets a UI change reuse their cache.
        advancedChunks: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: "radix",
              test: /node_modules[\\/]@radix-ui[\\/]/,
            },
            {
              name: "motion",
              test: /node_modules[\\/]framer-motion[\\/]/,
            },
            {
              name: "charts",
              test: /node_modules[\\/](recharts|d3-[a-z]+)[\\/]/,
            },
          ],
        },
      },
    },
  } as Record<string, unknown>,
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
