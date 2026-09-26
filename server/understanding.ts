import { complete, parseJson } from "./ai.js"
import { charge, db, namespaceFor, save, type Customer, type Insight, type Ticket } from "./db.js"
import { memoriesFor, remember } from "./memory.js"

// Long-term understanding of each customer:
//  1. every conversation is summarised into Walrus Memory, so the bot knows
//     what happened last time even in a brand-new chat;
//  2. an "insight" (who they are, how they like to be spoken to, what they'll
//     probably want) drives the personal welcome and drafted suggestions.

const transcript = (t: Ticket) =>
  t.messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "customer" ? "Customer" : m.role === "ai" ? "Assistant" : "Teammate"}: ${m.text}`)
    .join("\n")

/** Summarises a conversation into memory if it has changed since the last summary. */
export async function summarizeTicket(t: Ticket) {
  const c = db.customers[t.customerId]
  const customerTurns = t.messages.filter((m) => m.role === "customer").length
  if (!c || customerTurns < 1 || (t.summarizedAt ?? 0) >= t.messages.length) return
  const covered = t.messages.length
  try {
    const { text, usage } = await complete(
      "You write long-term memory notes for a support team. Be factual and brief.",
      `Summarise this support conversation in 1-2 sentences for the customer's long-term memory: what they wanted, what happened, and anything still open. No preamble.\n\n${transcript(t).slice(-8000)}`,
      400
    )
    charge(usage, c, t)
    if (!text) return
    const date = new Date(t.createdAt).toLocaleDateString("en-CA") // local YYYY-MM-DD
    t.summary = text
    t.summarizedAt = covered
    save()
    await remember(namespaceFor(c), `Past conversation #${t.number} (${date}): ${text}`)
  } catch (err) {
    console.warn("[understanding] summary failed:", (err as Error).message)
  }
}

// Summarise a conversation once it goes quiet, so it's remembered even if
// nobody resolves the ticket.
const timers = new Map<string, ReturnType<typeof setTimeout>>()
export function summarizeWhenIdle(t: Ticket, ms = 90_000) {
  clearTimeout(timers.get(t.id))
  timers.set(
    t.id,
    setTimeout(() => {
      timers.delete(t.id)
      void summarizeTicket(t)
    }, ms)
  )
}

export function defaultWelcome(): Pick<Insight, "greeting" | "suggestions"> {
  const s = db.settings
  return {
    greeting: `Hi, I'm ${s.botName}. Ask me anything about ${s.company}. I'll remember what matters so you never have to explain twice.`,
    suggestions: ["What does Pro include?", "Talk to a human", "Why connect a wallet?"],
  }
}

const building = new Map<string, Promise<Insight | undefined>>()

/**
 * The bot's current understanding of a returning customer. Rebuilt when their
 * memory has grown, otherwise served from cache.
 */
export async function insightFor(c: Customer): Promise<Insight | undefined> {
  const memories = memoriesFor(namespaceFor(c))
  if (!memories.length) return undefined
  if (c.insight && c.insight.memCount === memories.length) return c.insight
  if (building.has(c.id)) return building.get(c.id)

  const job = (async () => {
    const facts = memories
      .slice(0, 40)
      .map((m) => `- ${m.text}`)
      .join("\n")
    const profile = [c.name && `Name: ${c.name}`, c.email && `Email: ${c.email}`, c.phone && `Phone: ${c.phone}`]
      .filter(Boolean)
      .join("\n")
    try {
      const { text, usage } = await complete(
        `You are ${db.settings.botName}, support assistant for ${db.settings.company}. You study what you remember about a customer so you can serve them personally.`,
        `What you remember about this returning customer (newest first):
${facts}
${profile ? `\nProfile:\n${profile}` : ""}

Return JSON only:
{"name": "their first name if you know it, else null",
 "summary": "2 sentences for the support team: who they are, what they care about, how they like to be spoken to (tone, language, channel)",
 "greeting": "a warm 1-2 sentence welcome-back message in their preferred language and tone, using their name if known and referencing their most recent open topic",
 "suggestions": ["3 short things THEY are likely to ask next, written in their voice, max 45 characters each"]}`,
        600
      )
      charge(usage, c)
      const data = parseJson<Partial<Insight> & { name?: string | null }>(text)
      if (!data?.greeting || !Array.isArray(data.suggestions)) return c.insight
      if (!c.name && typeof data.name === "string" && data.name.trim()) c.name = data.name.trim().slice(0, 60)
      c.insight = {
        summary: String(data.summary ?? ""),
        greeting: String(data.greeting),
        suggestions: data.suggestions.map(String).filter(Boolean).slice(0, 3),
        memCount: memories.length,
        at: Date.now(),
      }
      save()
      return c.insight
    } catch (err) {
      console.warn("[understanding] insight failed:", (err as Error).message)
      return c.insight
    } finally {
      building.delete(c.id)
    }
  })()
  building.set(c.id, job)
  return job
}
