import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app under /eigenbeleg-generator/ by default.
// If you use a custom domain, set base to "/".
export default defineConfig({
  plugins: [react()],
  base: "/eigenbeleg-generator/",
});
