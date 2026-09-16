import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

/**
 * Nitro auto-detects the `vercel` preset with zero config when the build
 * runs on Vercel's CI (VERCEL=1). Locally it falls back to node-server,
 * which is all we need for `vite dev` / `vite preview`.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
