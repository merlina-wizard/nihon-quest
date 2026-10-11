import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" fa funzionare la build sia su GitHub Pages (/nome-repo/) sia in locale.
export default defineConfig({
  plugins: [react()],
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
