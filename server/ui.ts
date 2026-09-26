import { z } from "zod"
import type { Customer, FormField, UiBlock } from "./db.js"

// Interactive cards the model may append to a reply as <ui>{json}</ui>.
// Anything that doesn't validate is dropped; the text reply still goes out.

const field = z.object({
  name: z.string().regex(/^[\w-]{1,40}$/),
  label: z.string().min(1).max(60),
  type: z.enum(["text", "email", "tel", "number", "date", "time", "textarea", "select"]).catch("text"),
  required: z.boolean().optional(),
  placeholder: z.string().max(80).optional(),
  options: z.array(z.string().max(60)).max(12).optional(),
})

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("choices"), options: z.array(z.string().min(1).max(60)).min(2).max(5) }),
  z.object({ type: z.literal("rating"), question: z.string().max(120).catch("How did we do?") }),
  z
    .object({
      type: z.literal("form"),
      title: z.string().max(80).catch("A few details"),
      fields: z.array(field).min(1).max(8).optional(),
      steps: z
        .array(z.object({ title: z.string().max(40), fields: z.array(field).min(1).max(6) }))
        .min(2)
        .max(5)
        .optional(),
      submit: z.string().max(30).optional(),
    })
    .refine((f) => f.fields || f.steps, "form needs fields or steps"),
  z.object({
    type: z.literal("timeline"),
    title: z.string().max(80).catch("What happens next"),
    steps: z
      .array(
        z.object({
          label: z.string().min(1).max(80),
          detail: z.string().max(160).optional(),
          date: z.string().max(40).optional(),
          status: z.enum(["done", "current", "upcoming"]).catch("upcoming"),
        })
      )
      .min(2)
      .max(8),
    options: z.array(z.string().min(1).max(40)).max(3).optional(),
  }),
])

export const UI_GUIDE = `## Interactive cards
Make the chat feel like a helpful app, not a text box. End a reply with ONE <ui>JSON</ui> card whenever it saves the customer typing or makes next steps clearer:
- Quick replies for likely next steps or a yes/no question:
  <ui>{"type":"choices","options":["Yes, that fixed it","Still not working"]}</ui>
- A form to collect details. Short one-page form:
  <ui>{"type":"form","title":"Your contact details","fields":[{"name":"email","label":"Email","type":"email","required":true},{"name":"phone","label":"Phone","type":"tel"}],"submit":"Send"}</ui>
  For anything with several stages (a booking, an order change, a bug report, onboarding), use a multi-step form; the customer sees progress and reviews before sending. Example shape (adapt the steps and fields to the actual request):
  <ui>{"type":"form","title":"Report a problem","steps":[{"title":"What happened","fields":[{"name":"issue","label":"What went wrong?","type":"textarea","required":true},{"name":"device","label":"Device","type":"select","options":["Phone","Laptop","Tablet"]}]},{"title":"When","fields":[{"name":"happened_on","label":"Date it started","type":"date"}]},{"title":"Contact","fields":[{"name":"email","label":"Email","type":"email","required":true}]}],"submit":"Send report"}</ui>
  Field types: text, email, tel, number, date, time, textarea, select (select needs "options"). Use the field names name, email, phone and company for those details so they're saved to the customer's profile; use snake_case names for everything else.
- A timeline to show what happens next, the status of a request, or a step-by-step fix the customer can follow themselves. Take dates from the calendar above, never compute them. Example shape:
  <ui>{"type":"timeline","title":"Your refund","steps":[{"label":"Request received","status":"done","date":"Today"},{"label":"Team reviews it","status":"current","detail":"Usually within a day"},{"label":"Money back on your card","status":"upcoming","date":"<date from calendar>"}],"options":["Sounds good","I have a question"]}</ui>
- A rating once the issue is solved: <ui>{"type":"rating","question":"Did that solve it?"}</ui>
One card per reply. Never ask, in a form or otherwise, for details you already know.`

/** Splits a raw model reply into visible text and a validated card. */
export function extractUi(raw: string): { text: string; ui?: UiBlock } {
  const match = raw.match(/<ui>([\s\S]*?)(<\/ui>|$)/)
  if (!match) return { text: raw.trim() }
  const text = raw.replace(match[0], "").trim()
  try {
    const parsed = block.safeParse(JSON.parse(match[1].trim()))
    return { text, ui: parsed.success ? (parsed.data as UiBlock) : undefined }
  } catch {
    return { text }
  }
}

export const formFields = (ui: Extract<UiBlock, { type: "form" }>): FormField[] =>
  ui.steps ? ui.steps.flatMap((s) => s.fields) : (ui.fields ?? [])

/** Contact form for hand-offs, asking only for what we don't already have. */
export function contactForm(c: Customer): UiBlock | undefined {
  if (c.email || c.phone) return undefined
  return {
    type: "form",
    title: "How can the team reach you?",
    fields: [
      ...(c.name ? [] : [{ name: "name", label: "Name", type: "text" }]),
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone (optional)", type: "tel" },
    ],
    submit: "Send details",
  }
}

/** Human-readable version of a submitted card, used as the customer's message. */
export function describeSubmission(ui: UiBlock, values: Record<string, string>) {
  if (ui.type === "choices" || ui.type === "timeline") return values.choice ?? ""
  if (ui.type === "rating") return `Rated ${values.rating}/5${values.comment ? `: ${values.comment}` : ""}`
  const lines = formFields(ui)
    .filter((f) => values[f.name]?.trim())
    .map((f) => `${f.label}: ${values[f.name].trim()}`)
  return `${ui.title}\n${lines.join("\n")}`
}
