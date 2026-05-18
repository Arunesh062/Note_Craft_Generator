import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(({ mode }) => {
  const isContentScript = mode === 'content';

  if (isContentScript) {
    // Specialized build for the Content Script to produce a single IIFE bundle
    return {
      plugins: [react()],
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      build: {
        emptyOutDir: false, // Don't delete the popup build
        outDir: 'dist',
        lib: {
          entry: resolve(__dirname, 'content.jsx'),
          name: 'NoteCraftContent',
          formats: ['iife'],
          fileName: () => 'content.iife.js',
        },
        rollupOptions: {
          output: {
            extend: true,
          }
        }
      }
    }
  }

  // Standard build for Popup and static files
  return {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: 'background.js', dest: '.' },
          { src: 'offscreen.js', dest: '.' },
          { src: 'offscreen.html', dest: '.' },
          { src: 'ready.html', dest: '.' },
          { src: 'public/manifest.json', dest: '.' },
          { src: 'public/icons', dest: '.' }
        ]
      })
    ],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'index.html'),
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  }
})
