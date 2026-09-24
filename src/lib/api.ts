export type Role = "customer" | "ai" | "agent" | "system"
export type ReplyMode = "autopilot" | "copilot" | "human"
export type TicketStatus = "open" | "pending" | "resolved"
export type MemoryRef = { text: string; blobId?: string }

export type Tokens = { input: number; output: number }

export type FormField = { name: string; label: string; type: string; required?: boolean; placeholder?: string; options?: string[] }
export type TimelineStep = { label: string; detail?: string; date?: string; status: "done" | "current" | "upcoming" }
export type UiBlock =
  | { type: "choices"; options: string[] }
  | { type: "rating"; question: string }
  | { type: "form"; title: string; fields?: FormField[]; steps?: { title: string; fields: FormField[] }[]; submit?: string }
  | { type: "timeline"; title: string; steps: TimelineStep[]; options?: string[] }

export type Message = {
  id: string
  role: Role
  text: string
  at: number
  memories?: MemoryRef[]
  ui?: UiBlock
  submitted?: Record<string, string>
}

export type PublicCustomer = {
  id: string
  wallet?: string
  name?: string
  email?: string
  phone?: string
  tier: "guest" | "verified"
  memoryCount: number
  tokens: Tokens
}

export type CustomerDetail = PublicCustomer & {
  details: Record<string, string>
  insight?: string
  ticketCount: number
  openTickets: number
  lastSeen: number
  createdAt: number
}

export type TicketSummary = {
  id: string
  number: number
  subject: string
  status: TicketStatus
  priority: "normal" | "high"
  mode: ReplyMode
  unread: boolean
  createdAt: number
  updatedAt: number
  lastMessage?: { role: Role; text: string }
  customer: PublicCustomer | null
  tokens: Tokens
  rating?: number
  summary?: string
}

export type TicketDetail = TicketSummary & {
  messages: Message[]
  memories: { id: string; text: string; blobId?: string; at: number }[]
  customerDetail: CustomerDetail | null
}

export type ModelCheck = { ok: boolean; ms: number; error?: string; at: number }

export type Status = {
  memoryMode: "walrus" | "mock"
  model: string
  usage: { inputTokens: number; outputTokens: number; operator?: Tokens }
  tokenBudget: number
  settings: { botName: string; company: string; knowledge: string; collect: string[]; thinking: boolean }
  counts: { open: number; memories: number; customers: number }
}

// The embed script can point the widget at another origin.
export const API_BASE = (typeof window !== "undefined" && (window as { INTERCALL_API?: string }).INTERCALL_API) || ""

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data as T
}

/** POSTs and reads the server-sent-event response, calling onEvent per event. */
export async function stream(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void
) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Request failed")
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    let i
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const event = chunk.match(/^event: (.*)$/m)?.[1] ?? "message"
      const data = chunk.match(/^data: (.*)$/m)?.[1]
      onEvent(event, data ? JSON.parse(data) : null)
    }
  }
}

/** Hides [[MARKER]] lines (hand-off, ticket actions), including a half-streamed one at the end. */
export const cleanReply = (t: string) =>
  t.replace(/\[\[[A-Z]+[^\]\n]*\]\]/g, "").replace(/\[\[[A-Z0-9 #]*\]?$/, "").trimEnd()

/** 12345 → "12.3k" */
export function formatTokens(n: number) {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

export const totalTokens = (t?: Tokens) => (t ? t.input + t.output : 0)

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function timeAgo(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const embedSnippet = () => `<script src="${location.origin}/widget.js" async></script>`

/** Opens the page's chat widget from anywhere (e.g. a hero button). */
export const openChat = () => window.dispatchEvent(new Event("intercall:open"))
