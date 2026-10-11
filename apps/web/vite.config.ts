import { defineConfig } from 'vite';

export default defineConfig({
  // Game views are React Native components shared with the phone app; react-native-web draws them in the browser.
  resolve: { alias: { 'react-native': 'react-native-web' } },
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
