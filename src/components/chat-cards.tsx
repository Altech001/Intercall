import { useState } from "react"
import { ArrowLeft, Check, Circle, Loader2, Pencil, Star } from "lucide-react"
import type { FormField, UiBlock } from "@/lib/api"
import { cn } from "@/lib/utils"

type Props = {
  ui: UiBlock
  submitted?: Record<string, string>
  disabled?: boolean
  onSubmit: (values: Record<string, string>) => Promise<void> | void
}

/** Renders an interactive card the assistant attached to its reply. */
export function ChatCard(props: Props) {
  const { ui } = props
  if (ui.type === "choices") return <Choices {...props} options={ui.options} />
  if (ui.type === "rating") return <Rating {...props} ui={ui} />
  if (ui.type === "timeline") return <Timeline {...props} ui={ui} />
  return <Form {...props} ui={ui} />
}

function Choices({ options, submitted, disabled, onSubmit }: Props & { options: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const picked = submitted?.choice === o
        return (
          <button
            key={o}
            type="button"
            disabled={disabled || !!submitted}
            onClick={() => void onSubmit({ choice: o })}
            className={cn(
              "border px-3 py-1.5 text-left text-xs transition-colors",
              picked ? "border-foreground bg-foreground text-background" : "bg-background enabled:hover:border-foreground",
              submitted && !picked && "opacity-40"
            )}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Rating({ ui, submitted, disabled, onSubmit }: Props & { ui: Extract<UiBlock, { type: "rating" }> }) {
  const [hover, setHover] = useState(0)
  const value = Number(submitted?.rating ?? 0)
  return (
    <div className="w-full border bg-background p-3">
      <div className="text-xs font-medium">{ui.question}</div>
      <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            disabled={disabled || !!submitted}
            onMouseEnter={() => setHover(n)}
            onClick={() => void onSubmit({ rating: String(n) })}
            className="p-0.5 transition-transform enabled:hover:scale-110"
          >
            <Star className={cn("size-5", n <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
      {submitted && <div className="mt-1.5 text-[11px] text-muted-foreground">Thanks for the feedback!</div>}
    </div>
  )
}

function Timeline({ ui, submitted, disabled, onSubmit }: Props & { ui: Extract<UiBlock, { type: "timeline" }> }) {
  return (
    <div className="w-full border bg-background">
      <div className="border-b px-3 py-2 text-xs font-semibold">{ui.title}</div>
      <ol className="px-3 py-3">
        {ui.steps.map((s, i) => {
          const last = i === ui.steps.length - 1
          return (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span className={cn("absolute top-5 bottom-0 left-2.25 w-px", s.status === "done" ? "bg-foreground" : "bg-border")} />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid size-4.75 shrink-0 place-items-center rounded-full border",
                  s.status === "done" && "border-foreground bg-foreground text-background",
                  s.status === "current" && "border-fuchsia-500 bg-background",
                  s.status === "upcoming" && "bg-background"
                )}
              >
                {s.status === "done" ? (
                  <Check className="size-3" />
                ) : s.status === "current" ? (
                  <span className="size-2 animate-pulse rounded-full bg-fuchsia-500" />
                ) : (
                  <Circle className="size-1.5 fill-border text-border" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-xs", s.status === "upcoming" ? "text-muted-foreground" : "font-medium")}>{s.label}</span>
                  {s.date && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{s.date}</span>}
                </div>
                {s.detail && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.detail}</p>}
              </div>
            </li>
          )
        })}
      </ol>
      {!!ui.options?.length && (
        <div className="border-t p-2">
          <Choices ui={ui} options={ui.options} submitted={submitted} disabled={disabled} onSubmit={onSubmit} />
        </div>
      )}
    </div>
  )
}

/** One-page form, or a step-by-step wizard with progress and a review before sending. */
function Form({ ui, submitted, disabled, onSubmit }: Props & { ui: Extract<UiBlock, { type: "form" }> }) {
  const steps = ui.steps ?? [{ title: ui.title, fields: ui.fields ?? [] }]
  const multi = steps.length > 1
  const [values, setValues] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const reviewing = multi && step === steps.length
  const allFields = steps.flatMap((s) => s.fields)

  if (submitted) {
    return (
      <div className="w-full border bg-background">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold">{ui.title}</span>
          <span className="flex items-center gap-1 text-[10px] tracking-widest text-emerald-600 uppercase">
            <Check className="size-3" /> Sent
          </span>
        </div>
        <Summary fields={allFields} values={submitted} />
      </div>
    )
  }

  return (
    <form
      className="w-full border bg-background"
      onSubmit={async (e) => {
        e.preventDefault()
        if (multi && !reviewing) return setStep((s) => s + 1)
        setBusy(true)
        await onSubmit(values)
        setBusy(false)
      }}
    >
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">{ui.title}</span>
          {multi && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {reviewing ? "Review" : `Step ${step + 1}/${steps.length}`}
            </span>
          )}
        </div>
        {multi && (
          <div className="mt-2 flex gap-1">
            {steps.map((s, i) => (
              <span key={i} title={s.title} className={cn("h-1 flex-1 transition-colors", i < step || reviewing ? "bg-foreground" : i === step ? "bg-fuchsia-500" : "bg-border")} />
            ))}
          </div>
        )}
      </div>

      {reviewing ? (
        <div>
          {steps.map((s, i) => (
            <div key={i} className="border-b last:border-b-0">
              <div className="flex items-center justify-between px-3 pt-2">
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{s.title}</span>
                <button type="button" onClick={() => setStep(i)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                  <Pencil className="size-2.5" /> Edit
                </button>
              </div>
              <Summary fields={s.fields} values={values} />
            </div>
          ))}
        </div>
      ) : (
        <div key={step} className="ic-rise space-y-2.5 p-3">
          {multi && <div className="text-sm font-medium">{steps[step].title}</div>}
          {steps[step].fields.map((f) => (
            <Field key={f.name} f={f} value={values[f.name] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
          ))}
        </div>
      )}

      <div className="flex gap-2 px-3 pb-3">
        {multi && step > 0 && (
          <button type="button" aria-label="Back" onClick={() => setStep((s) => s - 1)} className="grid size-9 shrink-0 place-items-center border hover:bg-muted">
            <ArrowLeft className="size-3.5" />
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || busy}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 bg-primary text-xs font-semibold tracking-widest text-primary-foreground uppercase disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {multi && !reviewing ? (step === steps.length - 1 ? "Review" : "Next") : ui.submit || "Submit"}
        </button>
      </div>
    </form>
  )
}

function Summary({ fields, values }: { fields: FormField[]; values: Record<string, string> }) {
  return (
    <dl className="space-y-1 px-3 py-2 text-xs">
      {fields.map((f) => (
        <div key={f.name} className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground">{f.label}:</dt>
          <dd className="min-w-0 wrap-break-word">{values[f.name] || "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

function Field({ f, value, onChange }: { f: FormField; value: string; onChange: (v: string) => void }) {
  const cls = "w-full border bg-transparent px-2.5 py-2 text-sm outline-none focus:border-foreground/50"
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-muted-foreground">
        {f.label}
        {f.required && <span className="text-destructive"> *</span>}
      </span>
      {f.type === "textarea" ? (
        <textarea rows={3} required={f.required} value={value} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} className={cn(cls, "resize-none")} />
      ) : f.type === "select" && f.options?.length ? (
        <select required={f.required} value={value} onChange={(e) => onChange(e.target.value)} className={cn(cls, "bg-background")}>
          <option value="">Choose…</option>
          {f.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={["email", "tel", "number", "date", "time"].includes(f.type) ? f.type : "text"}
          required={f.required}
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </label>
  )
}
