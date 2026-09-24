import type { IncomingMessage, ServerResponse } from "node:http"
import { Readable } from "node:stream"

type WebHandler = (req: Request) => Promise<Response>

/** Adapts a fetch-style handler to Node's (req, res) so Vite and node:http can host it. */
export async function serveNode(handler: WebHandler, req: IncomingMessage, res: ServerResponse) {
  const origin = `http://${req.headers.host ?? "localhost"}`
  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  const request = new Request(new URL(req.url ?? "/", origin), {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    duplex: "half", // Node requires this for streamed request bodies
  } as RequestInit)
  const response = await handler(request)
  res.statusCode = response.status
  response.headers.forEach((v, k) => res.setHeader(k, v))
  if (!response.body) return res.end()
  res.flushHeaders()
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk)
  res.end()
}
