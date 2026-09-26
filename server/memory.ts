import { MemWal, MemWalMock } from "@mysten-incubation/memwal"
import { db, id, save, type MemoryRef } from "./db.js"

// Walrus Memory: each customer gets their own namespace. The relayer embeds,
// Seal-encrypts and uploads every memory to Walrus; recall decrypts only what
// this delegate key is allowed to read.
const key = process.env.MEMWAL_PRIVATE_KEY
const accountId = process.env.MEMWAL_ACCOUNT_ID

export const memoryMode: "walrus" | "mock" = key && accountId ? "walrus" : "mock"

type Client = Pick<MemWal, "recall" | "analyze" | "remember" | "getRememberBulkStatus">

const g = globalThis as unknown as { __memwal?: Client }
const client: Client = (g.__memwal ??=
  memoryMode === "walrus"
    ? MemWal.create({
        key: key!,
        accountId: accountId!,
        serverUrl: process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz",
        namespace: "intercall",
      })
    : // Local stand-in so the app runs without credentials; seeded from the log.
      MemWalMock.create({
        namespace: "intercall",
        initialMemories: db.memories.map((m) => ({
          text: m.text,
          namespace: m.namespace,
          blobId: m.blobId,
        })),
      }))

const profiles = new Map<string, { at: number; results: Awaited<ReturnType<Client["recall"]>>["results"] }>()

const PROFILE_QUERY = "Who is this customer? Name, business, plan, preferences, preferred contact channel, past issues"

/**
 * Memories relevant to this message, plus the customer's core profile so the
 * bot knows who it's talking to even when the question itself is unrelated.
 */
export async function recall(namespace: string, query: string): Promise<MemoryRef[]> {
  const search = (q: string) =>
    client
      .recall({ query: q, namespace, limit: 6, maxDistance: 0.95 })
      .then((r) => r.results)
      .catch((err) => {
        console.warn("[memory] recall failed:", (err as Error).message)
        return []
      })
  // The profile rarely changes, so it's cached per customer until they learn something new
  // (Walrus Memory keys are rate-limited to 60 weighted requests a minute).
  const cached = profiles.get(namespace)
  const profileP = cached && Date.now() - cached.at < 5 * 60_000 ? Promise.resolve(cached.results) : search(PROFILE_QUERY)
  const [relevant, profile] = await Promise.all([search(query), profileP])
  if (!cached || cached.results !== profile) profiles.set(namespace, { at: Date.now(), results: profile })
  const seen = new Set<string>()
  return [...relevant, ...profile]
    .filter((r) => !seen.has(r.text) && seen.add(r.text))
    .slice(0, 10)
    .map((r) => ({ text: r.text, blobId: r.blob_id }))
}

/** Extract durable facts about the customer from what they said and store them. */
export async function learn(namespace: string, customerText: string) {
  try {
    const res = await withRetry(() => client.analyze(customerText, namespace))
    for (const f of res.facts) log(namespace, f.text, f.blob_id, f.job_id)
    return res.facts.length
  } catch (err) {
    console.warn("[memory] analyze failed:", (err as Error).message)
    return 0
  }
}

export async function remember(namespace: string, text: string) {
  const job = await withRetry(() => client.remember(text, namespace))
  log(namespace, text, undefined, job.job_id)
}

// Uploads in flight: memories logged with a job id (their record id) and no blob id
// yet. One batched status check every 10s records each memory's Walrus blob id once
// the relayer has Seal-encrypted and stored it. Derived from `db`, so it survives
// restarts and serverless instances (which call settlePending() per request).
const SETTLE_FOR = 15 * 60_000
const abandoned = new Set<string>()
let lastSettle = 0

export async function settlePending() {
  if (Date.now() - lastSettle < 10_000) return
  lastSettle = Date.now()
  const waiting = db.memories.filter((m) => !m.blobId && !abandoned.has(m.id) && Date.now() - m.at < SETTLE_FOR)
  if (!waiting.length) return
  const res = await client.getRememberBulkStatus(waiting.slice(0, 50).map((m) => m.id)).catch(() => undefined)
  for (const job of res?.results ?? []) {
    const rec = db.memories.find((m) => m.id === job.job_id)
    if (!rec) continue
    if (job.blob_id) rec.blobId = job.blob_id
    else if (job.status === "failed" || job.status === "not_found") {
      console.warn("[memory] upload not confirmed for job", job.job_id, job.error ?? job.status)
      abandoned.add(rec.id)
    }
  }
  save()
}
const gp = globalThis as { __memSettler?: ReturnType<typeof setInterval> }
clearInterval(gp.__memSettler)
gp.__memSettler = setInterval(() => void settlePending(), 10_000)

/** Retries once after the relayer's rate-limit window. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const wait = Number((err as Error).message.match(/retry_after_seconds":(\d+)/)?.[1] ?? 0)
    if (!/429/.test((err as Error).message)) throw err
    await new Promise((r) => setTimeout(r, Math.min(wait || 30, 90) * 1000))
    return fn()
  }
}

/** Carry a guest's memories over to their wallet namespace once verified. */
export async function migrate(from: string, to: string) {
  const facts = db.memories.filter((m) => m.namespace === from)
  for (const f of facts) {
    if (db.memories.some((m) => m.namespace === to && m.text === f.text)) continue
    await remember(to, f.text).catch(() => {})
  }
}

function log(namespace: string, text: string, blobId?: string, jobId?: string) {
  profiles.delete(namespace)
  const rec = { id: jobId ?? id(), namespace, text, blobId, at: Date.now() }
  db.memories.push(rec)
  save()
  return rec
}

export function memoriesFor(namespace: string) {
  return db.memories.filter((m) => m.namespace === namespace).sort((a, b) => b.at - a.at)
}
