import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const sandboxDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN;
const previewMode = process.env.BASE44_PREVIEW_MODE === '1';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Bind mounts on the sandbox do not always emit inotify events.
    watch: { usePolling: true, interval: 400 },
    allowedHosts: sandboxDomain ? ['localhost', `.${sandboxDomain}`] : ['localhost'],
    // The preview is served over HTTPS on a proxied host, so HMR must use wss/443.
    hmr: previewMode ? { protocol: 'wss', clientPort: 443 } : undefined,
    proxy: {
      '/api': {
        target: process.env.CABLE_API_URL ?? 'http://api:4000',
        changeOrigin: false,
        cookieDomainRewrite: '',
      },
    },
  },
  preview: { host: '0.0.0.0', port: 5173 },
});
