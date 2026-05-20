// vite.config.js
import { defineConfig } from "file:///D:/Github/Note_Craft_Generator/extension-react/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Github/Note_Craft_Generator/extension-react/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve } from "path";
import { viteStaticCopy } from "file:///D:/Github/Note_Craft_Generator/extension-react/node_modules/vite-plugin-static-copy/dist/index.js";
var __vite_injected_original_dirname = "D:\\Github\\Note_Craft_Generator\\extension-react";
var vite_config_default = defineConfig(({ mode }) => {
  const isContentScript = mode === "content";
  if (isContentScript) {
    return {
      plugins: [react()],
      define: {
        "process.env.NODE_ENV": JSON.stringify("production")
      },
      build: {
        emptyOutDir: false,
        // Don't delete the popup build
        outDir: "dist",
        lib: {
          entry: resolve(__vite_injected_original_dirname, "content.jsx"),
          name: "NoteCraftContent",
          formats: ["iife"],
          fileName: () => "content.iife.js"
        },
        rollupOptions: {
          output: {
            extend: true
          }
        }
      }
    };
  }
  return {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: "background.js", dest: "." },
          { src: "offscreen.js", dest: "." },
          { src: "offscreen.html", dest: "." },
          { src: "ready.html", dest: "." },
          { src: "public/manifest.json", dest: "." },
          { src: "public/icons", dest: "." }
        ]
      })
    ],
    build: {
      outDir: "dist",
      rollupOptions: {
        input: {
          popup: resolve(__vite_injected_original_dirname, "index.html")
        },
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name].[ext]"
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxHaXRodWJcXFxcTm90ZV9DcmFmdF9HZW5lcmF0b3JcXFxcZXh0ZW5zaW9uLXJlYWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxHaXRodWJcXFxcTm90ZV9DcmFmdF9HZW5lcmF0b3JcXFxcZXh0ZW5zaW9uLXJlYWN0XFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9HaXRodWIvTm90ZV9DcmFmdF9HZW5lcmF0b3IvZXh0ZW5zaW9uLXJlYWN0L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgdml0ZVN0YXRpY0NvcHkgfSBmcm9tICd2aXRlLXBsdWdpbi1zdGF0aWMtY29weSdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBpc0NvbnRlbnRTY3JpcHQgPSBtb2RlID09PSAnY29udGVudCc7XG5cbiAgaWYgKGlzQ29udGVudFNjcmlwdCkge1xuICAgIC8vIFNwZWNpYWxpemVkIGJ1aWxkIGZvciB0aGUgQ29udGVudCBTY3JpcHQgdG8gcHJvZHVjZSBhIHNpbmdsZSBJSUZFIGJ1bmRsZVxuICAgIHJldHVybiB7XG4gICAgICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gICAgICBkZWZpbmU6IHtcbiAgICAgICAgJ3Byb2Nlc3MuZW52Lk5PREVfRU5WJzogSlNPTi5zdHJpbmdpZnkoJ3Byb2R1Y3Rpb24nKSxcbiAgICAgIH0sXG4gICAgICBidWlsZDoge1xuICAgICAgICBlbXB0eU91dERpcjogZmFsc2UsIC8vIERvbid0IGRlbGV0ZSB0aGUgcG9wdXAgYnVpbGRcbiAgICAgICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgICAgIGxpYjoge1xuICAgICAgICAgIGVudHJ5OiByZXNvbHZlKF9fZGlybmFtZSwgJ2NvbnRlbnQuanN4JyksXG4gICAgICAgICAgbmFtZTogJ05vdGVDcmFmdENvbnRlbnQnLFxuICAgICAgICAgIGZvcm1hdHM6IFsnaWlmZSddLFxuICAgICAgICAgIGZpbGVOYW1lOiAoKSA9PiAnY29udGVudC5paWZlLmpzJyxcbiAgICAgICAgfSxcbiAgICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAgIG91dHB1dDoge1xuICAgICAgICAgICAgZXh0ZW5kOiB0cnVlLFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFN0YW5kYXJkIGJ1aWxkIGZvciBQb3B1cCBhbmQgc3RhdGljIGZpbGVzXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW1xuICAgICAgcmVhY3QoKSxcbiAgICAgIHZpdGVTdGF0aWNDb3B5KHtcbiAgICAgICAgdGFyZ2V0czogW1xuICAgICAgICAgIHsgc3JjOiAnYmFja2dyb3VuZC5qcycsIGRlc3Q6ICcuJyB9LFxuICAgICAgICAgIHsgc3JjOiAnb2Zmc2NyZWVuLmpzJywgZGVzdDogJy4nIH0sXG4gICAgICAgICAgeyBzcmM6ICdvZmZzY3JlZW4uaHRtbCcsIGRlc3Q6ICcuJyB9LFxuICAgICAgICAgIHsgc3JjOiAncmVhZHkuaHRtbCcsIGRlc3Q6ICcuJyB9LFxuICAgICAgICAgIHsgc3JjOiAncHVibGljL21hbmlmZXN0Lmpzb24nLCBkZXN0OiAnLicgfSxcbiAgICAgICAgICB7IHNyYzogJ3B1YmxpYy9pY29ucycsIGRlc3Q6ICcuJyB9XG4gICAgICAgIF1cbiAgICAgIH0pXG4gICAgXSxcbiAgICBidWlsZDoge1xuICAgICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgcG9wdXA6IHJlc29sdmUoX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpLFxuICAgICAgICB9LFxuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0uanMnLFxuICAgICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS5qcycsXG4gICAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltleHRdJ1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFvVSxTQUFTLG9CQUFvQjtBQUNqVyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBSC9CLElBQU0sbUNBQW1DO0FBS3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sa0JBQWtCLFNBQVM7QUFFakMsTUFBSSxpQkFBaUI7QUFFbkIsV0FBTztBQUFBLE1BQ0wsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLE1BQ2pCLFFBQVE7QUFBQSxRQUNOLHdCQUF3QixLQUFLLFVBQVUsWUFBWTtBQUFBLE1BQ3JEO0FBQUEsTUFDQSxPQUFPO0FBQUEsUUFDTCxhQUFhO0FBQUE7QUFBQSxRQUNiLFFBQVE7QUFBQSxRQUNSLEtBQUs7QUFBQSxVQUNILE9BQU8sUUFBUSxrQ0FBVyxhQUFhO0FBQUEsVUFDdkMsTUFBTTtBQUFBLFVBQ04sU0FBUyxDQUFDLE1BQU07QUFBQSxVQUNoQixVQUFVLE1BQU07QUFBQSxRQUNsQjtBQUFBLFFBQ0EsZUFBZTtBQUFBLFVBQ2IsUUFBUTtBQUFBLFlBQ04sUUFBUTtBQUFBLFVBQ1Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBR0EsU0FBTztBQUFBLElBQ0wsU0FBUztBQUFBLE1BQ1AsTUFBTTtBQUFBLE1BQ04sZUFBZTtBQUFBLFFBQ2IsU0FBUztBQUFBLFVBQ1AsRUFBRSxLQUFLLGlCQUFpQixNQUFNLElBQUk7QUFBQSxVQUNsQyxFQUFFLEtBQUssZ0JBQWdCLE1BQU0sSUFBSTtBQUFBLFVBQ2pDLEVBQUUsS0FBSyxrQkFBa0IsTUFBTSxJQUFJO0FBQUEsVUFDbkMsRUFBRSxLQUFLLGNBQWMsTUFBTSxJQUFJO0FBQUEsVUFDL0IsRUFBRSxLQUFLLHdCQUF3QixNQUFNLElBQUk7QUFBQSxVQUN6QyxFQUFFLEtBQUssZ0JBQWdCLE1BQU0sSUFBSTtBQUFBLFFBQ25DO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsZUFBZTtBQUFBLFFBQ2IsT0FBTztBQUFBLFVBQ0wsT0FBTyxRQUFRLGtDQUFXLFlBQVk7QUFBQSxRQUN4QztBQUFBLFFBQ0EsUUFBUTtBQUFBLFVBQ04sZ0JBQWdCO0FBQUEsVUFDaEIsZ0JBQWdCO0FBQUEsVUFDaEIsZ0JBQWdCO0FBQUEsUUFDbEI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
