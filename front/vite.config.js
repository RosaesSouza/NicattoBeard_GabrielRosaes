import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/inserts': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "Nicatto Beard",
        short_name: "Nicatto",
        description: "Sistema de gerenciamento Nicatto Beard em formato PWA.",
        lang: "pt-BR",
        dir: "ltr",
        orientation: "portrait-primary",
        theme_color: "#01325f",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",

        screenshots: [
          {
            src: "screenshots/desktop.png",
            sizes: "1280x800",
            type: "image/png",
            form_factor: "wide"
          },
          {
            src: "screenshots/mobile.png",
            sizes: "390x844",
            type: "image/png"
          }
        ],

        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      }
    })
  ]
});
