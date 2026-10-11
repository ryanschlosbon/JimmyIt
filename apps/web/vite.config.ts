import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist' },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/ai': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai/, ''),
        configure: (proxy) => {
          // The proxy only listens on loopback; browser Origin would be the Vite port, not the AI service port.
          proxy.on('proxyReq', (request) => request.removeHeader('origin'));
        },
      },
    },
  },
});
