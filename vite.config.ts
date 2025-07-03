// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // This allows all hosts
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok.io', // Allow all ngrok subdomains
      '.ngrok-free.app' // Allow ngrok free tier domains
    ],
  },
})