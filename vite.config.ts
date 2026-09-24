import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

// Mounts the InterCall API (server/api.ts) on the dev server so one
// `bun run dev` runs everything. Loaded through Vite so edits hot-reload.
function api(): Plugin {
  return {
    name: "intercall-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next()
        // Re-read .env so keys added while the dev server runs take effect without a restart.
        Object.assign(process.env, loadEnv(server.config.mode, import.meta.dirname, ""))
        try {
          const { handle } = await server.ssrLoadModule("/server/api.ts")
          const { serveNode } = await server.ssrLoadModule("/server/node.ts")
          await serveNode(handle, req, res)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Expose server-only secrets (ANTHROPIC_API_KEY, MEMWAL_*) to the API, never to the client bundle.
  Object.assign(process.env, loadEnv(mode, import.meta.dirname, ""))
  return {
    plugins: [react(), tailwindcss(), api()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  }
})
