import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发模式：前端 5174，接口代理到本地签到服务 127.0.0.1:4100
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:4100',
      '/uploads': 'http://127.0.0.1:3000',
    },
  },
});
