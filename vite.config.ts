import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // better-sqlite3 is a native N-API addon: keep it out of the SSR bundle and
  // out of the dev pre-bundler so the prebuilt .node binary is loaded at runtime.
  ssr: { external: ["better-sqlite3"] },
  optimizeDeps: { exclude: ["better-sqlite3"] },
  plugins: [
    ...devtools().map((p) => ({ ...p, apply: "serve" as const })),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
