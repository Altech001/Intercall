// Vercel serverless entry: vercel.json rewrites every /api/* request here, and it
// goes to the same handler the Bun server uses. Set DATABASE_URL (Neon) so data
// persists across instances.
import { waitUntil } from "@vercel/functions"
import { handle } from "../server/api.js"
import { background, flush, idle } from "../server/db.js"
import { settlePending } from "../server/memory.js"

export default {
  async fetch(req: Request) {
    const res = await handle(originalPath(req))
    background(settlePending())
    // Summaries and memory extraction finish after the response; keep the function alive for them.
    waitUntil(idle().then(flush))
    return res
  },
}

/** Restores /api/<path> if the rewrite handed us /api?path=<path>. */
function originalPath(req: Request) {
  const url = new URL(req.url)
  const path = url.searchParams.get("path")
  if (url.pathname !== "/api" || path === null) return req
  url.pathname = `/api/${path}`
  url.searchParams.delete("path")
  return new Request(url, req)
}
