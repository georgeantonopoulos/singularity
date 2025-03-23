import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for deployment
  base: './',
  
  // Server configuration
  server: {
    port: 5173,
    open: true
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Improve chunking strategy
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          vendor: ['three/examples/jsm/controls/OrbitControls.js']
        }
      }
    }
  },
  
  // Optimization
  optimizeDeps: {
    include: ['three']
  }
}); 