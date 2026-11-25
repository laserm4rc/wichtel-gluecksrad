import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Das Frontend liegt in web/, der fertige Build in dist/ (wird vom Express-Server ausgeliefert).
// Beim Entwickeln leitet Vite alle /api-Aufrufe an den lokalen Server weiter.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
