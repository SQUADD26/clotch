// Renderer: React + Vite, costruito in renderer/ (lo apre src/main.ts con loadFile).
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/ui",
  base: "./",
  plugins: [react()],
  build: { outDir: "../../renderer", emptyOutDir: true },
});
