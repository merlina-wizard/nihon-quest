import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base "./" fa funzionare la build sia su GitHub Pages (/nome-repo/) sia in locale.
export default defineConfig({
  plugins: [
    react(),
    // Service worker: l'app si apre anche senza rete (in metro, senza SIM).
    // I dati arrivano dalla cache di Firestore; qui si mettono in cache app, font e tile della mappa già viste.
    VitePWA({
      registerType: "prompt",
      manifest: false, // si usa public/manifest.webmanifest
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "index.html",
        // La versione attivata prende subito il controllo anche delle pagine aperte senza (PWA su iPhone).
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "font-css" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "font-file", expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === "tile.openstreetmap.org",
            handler: "CacheFirst",
            options: { cacheName: "map-tiles", expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  base: "./",
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore"], map: ["leaflet", "react-leaflet"] },
      },
    },
  },
});
