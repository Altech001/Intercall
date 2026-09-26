// Production server: serves the built app from dist/ and the API from one port.
// Build first with `bun run build`, then `bun run start`.
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { extname, join, normalize } from "node:path"
import { handle } from "./api.js"
import { serveNode } from "./node.js"

const DIST = join(import.meta.dirname, "..", "dist")
const PORT = Number(process.env.PORT || 8787)
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
}

createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/")) return await serveNode(handle, req, res)
    const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname))
    let file = join(DIST, path)
    if (!file.startsWith(DIST) || !(await stat(file).catch(() => null))?.isFile()) {
      file = join(DIST, "index.html") // SPA fallback
    }
    res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream")
    res.end(await readFile(file))
  } catch (err) {
    console.error(err)
    res.statusCode = 500
    res.end("Internal error")
  }
}).listen(PORT, () => console.log(`InterCall running on http://localhost:${PORT}`))
