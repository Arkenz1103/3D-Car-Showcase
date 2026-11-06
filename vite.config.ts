import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // Arena's preview proxy uses a host different from localhost. Bind to all
  // interfaces and allow that forwarded hostname in both dev and preview mode.
  server: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app"],
    // Keep the embedded preview stable while racing; changes require a manual
    // browser refresh instead of interrupting the session with HMR reloads.
    hmr: false,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app"],
  },
  plugins: [react(), tailwindcss()],
  build: {
    // Vercel serves static assets separately; keep the document small and let
    // browsers cache the JS, fonts, and on-demand GLB models independently.
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          "three-vendor": ["three", "three-mesh-bvh", "@react-three/fiber", "@react-three/drei"],
          "supabase-vendor": ["@supabase/supabase-js"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
