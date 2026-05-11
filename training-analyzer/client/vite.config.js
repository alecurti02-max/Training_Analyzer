import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite serves `client/` (where index.html lives) and builds to `client/dist/`.
// Legacy js/ + css/ + fonts/ at the root are imported by index.html and
// included by Vite as static assets during build (no copy needed).
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // The legacy entry (js/ui.js) is referenced as a module in index.html.
    // Vite will see it via the HTML parser and emit it alongside main.jsx.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    // During dev, proxy API calls to the backend on :3000 so the SPA can call
    // /api/* without CORS gymnastics.
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
