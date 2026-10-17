import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Local dev: run `func start` inside ./api (port 7071); Vite proxies /api to it.
export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:7072" } } });
