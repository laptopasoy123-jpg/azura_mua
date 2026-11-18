import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:8181'
  return {
    plugins: [vue()],
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia', '@supabase/supabase-js', '@lucide/vue'],
    },
    server: {
      host: '0.0.0.0',
      port: 8080,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/health': apiTarget,
      },
    },
  }
})
