import OpenAI from "openai"
import { db, type Tokens } from "./db.js"

// NVIDIA NIM speaks the OpenAI API. The model is picked in the dashboard
// (settings.model) and can be any id from integrate.api.nvidia.com/v1/models.
let client: OpenAI | undefined
function nim() {
  if (!process.env.NVIDIA_API_KEY) throw new MissingKeyError()
  return (client ??= new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
    timeout: 90_000,
    maxRetries: 1,
  }))
}

class MissingKeyError extends Error {
  constructor() {
    super("NVIDIA_API_KEY is not set")
  }
}

export type Turn = { role: "user" | "assistant"; content: string }

// Fast on NIM (~2s to first word) and good at following the card format.
const FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b"

export const currentModel = () => db.settings.model || process.env.NVIDIA_MODEL || FALLBACK_MODEL

export type Completion = { text: string; usage: Tokens }

/**
 * Streams a reply, calling onText per visible chunk. Resolves with the full
 * text (including any trailing <ui> block, which is never streamed) and usage.
 */
export async function reply(
  system: string,
  turns: Turn[],
  onText: (chunk: string) => void,
  model = currentModel()
): Promise<Completion> {
  try {
    return await streamOnce(system, turns, onText, model)
  } catch (err) {
    // If the chosen model stalls, returns nothing, or has been retired, answer
    // with the fallback model rather than leaving the customer waiting.
    const recoverable =
      err instanceof EmptyReplyError ||
      err instanceof OpenAI.APIUserAbortError ||
      err instanceof OpenAI.APIConnectionTimeoutError ||
      err instanceof OpenAI.NotFoundError ||
      // A stream NIM drops part-way surfaces as an APIError without a status.
      (err instanceof OpenAI.APIError && (err.status === undefined || err.status === 410 || err.status >= 500))
    if (!recoverable) throw err
    console.warn(`[ai] ${model} failed (${describe(err)}); retrying with ${FALLBACK_MODEL}`)
    return streamOnce(system, turns, onText, FALLBACK_MODEL)
  }
}

class EmptyReplyError extends Error {}

// Reasoning models (GLM, Nemotron, DeepSeek…) can think for a minute before the
// first word. For live chat that's off unless enabled in settings; templates that
// don't know the flag ignore it.
const thinkingArgs = () => (db.settings.thinking ? {} : { chat_template_kwargs: { enable_thinking: false } })

async function streamOnce(system: string, turns: Turn[], onText: (chunk: string) => void, model: string): Promise<Completion> {
  // Give up if the model goes quiet, so the customer isn't left waiting forever.
  const abort = new AbortController()
  let idle = setTimeout(() => abort.abort(), 45_000)
  const stream = await nim().chat.completions.create(
    {
      model,
      messages: [{ role: "system", content: system }, ...mergeTurns(turns)],
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 4096,
      stream: true,
      stream_options: { include_usage: true },
      ...thinkingArgs(),
    },
    { signal: abort.signal }
  )

  // Reasoning models may inline <think>…</think>; only the answer is shown.
  // Interactive <ui>{json}</ui> blocks are held back and parsed by the caller.
  let raw = ""
  let sent = 0
  let usage: Tokens | undefined
  for await (const chunk of stream) {
    if (chunk.usage) usage = { input: chunk.usage.prompt_tokens ?? 0, output: chunk.usage.completion_tokens ?? 0 }
    raw += chunk.choices[0]?.delta?.content ?? ""
    const visible = stripThinking(raw)
      .replace(/<ui>[\s\S]*$/, "")
      .replace(/<\/?[a-z]{0,5}$/, "")
    if (visible.length > sent) {
      onText(visible.slice(sent))
      sent = visible.length
      // Only visible progress counts: a model silently reasoning for minutes still times out.
      clearTimeout(idle)
      idle = setTimeout(() => abort.abort(), 45_000)
    }
  }
  clearTimeout(idle)
  const text = stripThinking(raw).trim()
  if (!text) throw new EmptyReplyError(`${model} returned an empty reply`)
  return { text, usage: usage ?? estimate(system + turns.map((t) => t.content).join(""), text) }
}

/** One-shot completion for background jobs (summaries, customer insight). */
export async function complete(system: string, prompt: string, maxTokens = 600): Promise<Completion> {
  // Leave room for reasoning models to think before answering.
  maxTokens = Math.max(maxTokens, 3000)
  const res = await nim().chat.completions.create({
    model: currentModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
    stream: false,
    ...thinkingArgs(),
  })
  const text = stripThinking(res.choices[0]?.message?.content ?? "").trim()
  const usage = res.usage
    ? { input: res.usage.prompt_tokens, output: res.usage.completion_tokens }
    : estimate(system + prompt, text)
  return { text, usage }
}

/** Parses the first JSON object in a model reply. */
export function parseJson<T>(text: string): T | undefined {
  const match = text.match(/\{[\s\S]*\}/)
  try {
    return match ? (JSON.parse(match[0]) as T) : undefined
  } catch {
    return undefined
  }
}

// Some NIM models omit usage on streams; fall back to ~4 chars per token.
const estimate = (input: string, output: string): Tokens => ({
  input: Math.ceil(input.length / 4),
  output: Math.ceil(output.length / 4),
})

const stripThinking = (s: string) => s.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/^\s+/, "")

// Strictly alternating roles, starting with the user.
function mergeTurns(turns: Turn[]): Turn[] {
  const out: Turn[] = []
  for (const t of turns) {
    const last = out.at(-1)
    if (last && last.role === t.role) last.content += "\n\n" + t.content
    else out.push({ ...t })
  }
  while (out[0]?.role === "assistant") out.shift()
  return out
}

// ---------- model catalogue ----------

export type ModelCheck = { ok: boolean; ms: number; error?: string; at: number }
const g = globalThis as unknown as { __nimChecks?: Record<string, ModelCheck>; __nimList?: { at: number; ids: string[] } }
const checks = (g.__nimChecks ??= {})

// Ids that aren't chat models (embedders, guards, parsers, vision-only…).
const NOT_CHAT = /embed|guard|safety|reward|parse|clip|detector|translate|deplot|kosmos|fuyu|vila|neva|retriever|calibration|diffusion|cosmos|starcoder|codegemma|recurrentgemma|zamba|gemma-2b|llama2|mixtral-8x22b-v0.1/

export async function listModels() {
  if (!g.__nimList || Date.now() - g.__nimList.at > 10 * 60_000) {
    const res = await nim().models.list()
    g.__nimList = { at: Date.now(), ids: res.data.map((m) => m.id).filter((id) => !NOT_CHAT.test(id)).sort() }
  }
  return g.__nimList.ids.map((id) => ({ id, check: checks[id] }))
}

/** Sends a tiny request so the picker can show which models answer for this key. */
export async function testModel(model: string): Promise<ModelCheck> {
  const start = Date.now()
  try {
    await nim().chat.completions.create(
      { model, messages: [{ role: "user", content: "Reply with: ok" }], max_tokens: 64, stream: false },
      { timeout: 30_000, maxRetries: 0 }
    )
    return (checks[model] = { ok: true, ms: Date.now() - start, at: Date.now() })
  } catch (err) {
    return (checks[model] = { ok: false, ms: Date.now() - start, error: describe(err), at: Date.now() })
  }
}

function describe(err: unknown) {
  if (err instanceof OpenAI.APIConnectionTimeoutError) return "Timed out (model busy or cold)"
  if (err instanceof OpenAI.NotFoundError) return "Not available for this API key"
  if (err instanceof OpenAI.APIError && err.status === 410) return "Retired by NVIDIA"
  if (err instanceof OpenAI.APIError) return `Error ${err.status}`
  return (err as Error).message
}

export function friendlyError(err: unknown) {
  if (err instanceof MissingKeyError)
    return "The assistant isn't configured yet (missing NVIDIA_API_KEY). A teammate will reply here shortly."
  if (err instanceof OpenAI.RateLimitError) return "We're a little busy right now. A teammate will reply here shortly."
  if (err instanceof OpenAI.APIUserAbortError) {
    console.error("[ai]", currentModel(), "went quiet for 60s")
    return "Sorry, that took too long on my side. A teammate will follow up here."
  }
  console.error("[ai]", currentModel(), describe(err))
  return "I couldn't answer that just now. A teammate will follow up here."
}
