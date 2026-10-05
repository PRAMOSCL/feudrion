import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El frontend delega /api en el backend local (puerto 3001 por defecto).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 3001}`, changeOrigin: false } },
  },
});
