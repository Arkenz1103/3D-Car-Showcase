import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

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
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
