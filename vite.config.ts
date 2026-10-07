import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Exclude tfjs-tflite from Vite dependency pre-bundling so it loads raw WASM/JS cleanly
    exclude: ["@tensorflow/tfjs-tflite"],
  },
  resolve: {
    // Allow resolving imports inside node_modules without explicit .js/.wasm extensions
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".wasm"],
  },
});
