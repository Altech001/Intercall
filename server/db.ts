import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { randomUUID } from "node:crypto"

export type Role = "customer" | "ai" | "agent" | "system"
export type TicketStatus = "open" | "pending" | "resolved"
export type ReplyMode = "autopilot" | "copilot" | "human"

export type MemoryRef = { text: string; blobId?: string }

export type Tokens = { input: number; output: number }

/** Interactive card the AI attaches under a reply (see server/ui.ts). */
export type FormField = { name: string; label: string; type: string; required?: boolean; placeholder?: string; options?: string[] }
export type TimelineStep = { label: string; detail?: string; date?: string; status: "done" | "current" | "upcoming" }

export type UiBlock =
  | { type: "choices"; options: string[] }
  | { type: "rating"; question: string }
  /** Single-page form (`fields`) or a multi-step wizard (`steps`). */
  | { type: "form"; title: string; fields?: FormField[]; steps?: { title: string; fields: FormField[] }[]; submit?: string }
  /** Progress of a process or a step-by-step guide, with optional follow-up buttons. */
  | { type: "timeline"; title: string; steps: TimelineStep[]; options?: string[] }

export type Message = {
  id: string
  role: Role
  text: string
  at: number
  memories?: MemoryRef[]
  ui?: UiBlock
  /** What the customer entered/picked in `ui`, once answered. */
  submitted?: Record<string, string>
}

/** The bot's understanding of a returning customer, rebuilt when memory grows. */
export type Insight = { summary: string; greeting: string; suggestions: string[]; memCount: number; at: number }

export type Customer = {
  id: string
  visitorIds: string[]
  wallet?: string
  name?: string
  email?: string
  phone?: string
  /** Other details the customer gave through forms. */
  details?: Record<string, string>
  insight?: Insight
  tokens?: Tokens
  createdAt: number
  lastSeen: number
}

export type Ticket = {
  id: string
  number: number
  customerId: string
  subject: string
  status: TicketStatus
  priority: "normal" | "high"
  mode: ReplyMode
  unread: boolean
  createdAt: number
  updatedAt: number
  messages: Message[]
  tokens?: Tokens
  rating?: number
  /** Conversation summary stored in Walrus Memory, and how many messages it covered. */
  summary?: string
  summarizedAt?: number
}

export type MemoryRecord = {
  id: string
  namespace: string
  text: string
  blobId?: string
  at: number
}

export type Settings = {
  botName: string
  company: string
  knowledge: string
  tokenBudget: number
  /** NVIDIA NIM model id; empty means NVIDIA_MODEL or the built-in default. */
  model: string
  /** Customer details the bot should gather over time, e.g. "company", "order number". */
  collect: string[]
  /** Let reasoning models think before answering: better on hard questions, much slower. */
  thinking: boolean
}

type Data = {
  customers: Record<string, Customer>
  tickets: Record<string, Ticket>
  memories: MemoryRecord[]
  sessions: Record<string, { address: string; at: number }>
  nonces: Record<string, number>
  settings: Settings
  usage: { inputTokens: number; outputTokens: number; operator?: Tokens }
  seq: number
}

const FILE = resolve(process.env.INTERCALL_DATA ?? "data/intercall.json")

const DEFAULTS: Data = {
  customers: {},
  tickets: {},
  memories: [],
  sessions: {},
  nonces: {},
  settings: {
    botName: "AMI",
    company: "InterCall",
    knowledge:
      "InterCall is a customer support platform. The chat widget is free for up to 500 conversations a month; Pro is $29/month. Wallet-connected customers get memory that follows them across devices and priority routing.",
    tokenBudget: 2_000_000,
    model: "",
    collect: ["name", "email", "phone", "company"],
    thinking: false,
  },
  usage: { inputTokens: 0, outputTokens: 0 },
  seq: 1000,
}

function load(): Data {
  try {
    const saved = JSON.parse(readFileSync(FILE, "utf8"))
    return { ...DEFAULTS, ...saved, settings: { ...DEFAULTS.settings, ...saved.settings } }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

// One process owns the file, so an in-memory copy with atomic writes is enough.
const g = globalThis as unknown as { __intercallDb?: Data }
export const db: Data = (g.__intercallDb ??= load())
// Backfill settings added since this process started (the dev server hot-reloads this module).
db.settings = { ...DEFAULTS.settings, ...db.settings }

let timer: ReturnType<typeof setTimeout> | undefined
export function save() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    mkdirSync(dirname(FILE), { recursive: true })
    writeFileSync(FILE + ".tmp", JSON.stringify(db, null, 2))
    renameSync(FILE + ".tmp", FILE)
  }, 50)
}

export const id = () => randomUUID()

export function message(role: Role, text: string, memories?: MemoryRef[]): Message {
  return { id: id(), role, text, at: Date.now(), memories }
}

export function customerForVisitor(visitorId: string): Customer {
  const existing = Object.values(db.customers).find((c) =>
    c.visitorIds.includes(visitorId)
  )
  if (existing) {
    existing.lastSeen = Date.now()
    return existing
  }
  const c: Customer = {
    id: `v_${visitorId}`,
    visitorIds: [visitorId],
    createdAt: Date.now(),
    lastSeen: Date.now(),
  }
  db.customers[c.id] = c
  save()
  return c
}

/** Charges model tokens to a customer and (optionally) one of their tickets. */
export function charge(usage: Tokens, c?: Customer, t?: Ticket) {
  db.usage.inputTokens += usage.input
  db.usage.outputTokens += usage.output
  for (const target of [c, t]) {
    if (!target) continue
    target.tokens ??= { input: 0, output: 0 }
    target.tokens.input += usage.input
    target.tokens.output += usage.output
  }
  if (!c) {
    db.usage.operator ??= { input: 0, output: 0 }
    db.usage.operator.input += usage.input
    db.usage.operator.output += usage.output
  }
  save()
}

export function namespaceFor(c: Customer) {
  return c.wallet ? `wallet:${c.wallet}` : `visitor:${c.id}`
}
