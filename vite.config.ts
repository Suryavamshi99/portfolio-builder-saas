import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

/**
 * The `nitro()` plugin is what actually wires Nitro into the build — it's
 * a SEPARATE Vite plugin from the `nitro` package being a dependency;
 * without it, `vite build` just does a plain Vite SSR build (dist/client +
 * dist/server/server.js as a generic Node entry) with no platform-specific
 * output at all, and Vercel has nothing in the shape it expects to route
 * requests to (404 on every path — confirmed by reproducing this locally
 * with VERCEL=1 before adding this plugin; it did not affect the build
 * output at all without it). The original personal-portfolio repo's
 * zero-config Vercel deploy worked because @lovable.dev/vite-tanstack-config
 * bundles this plugin internally — lost when that Lovable-specific wrapper
 * was deliberately not brought into this repo at scaffold time.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
  // pdf-parse/worker pulls in @napi-rs/canvas's native .node binary; Vite's
  // dev dependency-optimizer can't pre-bundle that and crashes on startup.
  // Not a build-time issue — `vite build` traces/copies it correctly.
  optimizeDeps: {
    exclude: ["pdf-parse", "pdf-parse/worker", "@napi-rs/canvas"],
  },
});
