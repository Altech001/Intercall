import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { ModelPicker } from "@/components/model-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api, embedSnippet } from "@/lib/api"
import { useDashboard } from "./context"

export function SettingsPage() {
  const { status, reload } = useDashboard()
  if (!status) return null
  return (
    <>
      <Form key={status.settings.botName + status.settings.company} initial={status.settings} reload={reload} mode={status.memoryMode} />
      <div className="absolute top-10 right-6 hidden border sm:block">
        <div className="px-3 pt-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Model</div>
        <ModelPicker current={status.model} onSaved={() => void reload()} align="right" side="bottom" />
      </div>
    </>
  )
}

function Form({
  initial,
  reload,
  mode,
}: {
  initial: { botName: string; company: string; knowledge: string; collect: string[]; thinking: boolean }
  reload: () => Promise<void>
  mode: "walrus" | "mock"
}) {
  const [s, setS] = useState(initial)
  const [collect, setCollect] = useState(initial.collect.join(", "))
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-12 px-4 py-10">
        <section>
          <h1 className="text-2xl font-bold tracking-tight">Bot & embed</h1>
          <p className="mt-1 text-sm text-muted-foreground">What your widget knows before it learns anything about the customer.</p>
        </section>

        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault()
            await api("/api/settings", { method: "PUT", body: { ...s, collect: collect.split(",") } })
            await reload()
            setSaved(true)
            setTimeout(() => setSaved(false), 1500)
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Bot name">
              <Input value={s.botName} onChange={(e) => setS({ ...s, botName: e.target.value })} />
            </Field>
            <Field label="Company">
              <Input value={s.company} onChange={(e) => setS({ ...s, company: e.target.value })} />
            </Field>
          </div>
          <Field
            label="Details to collect"
            hint="Comma separated. The bot gathers the missing ones naturally over time, with forms when it needs several at once."
          >
            <Input value={collect} onChange={(e) => setCollect(e.target.value)} placeholder="name, email, phone, company, order number" />
          </Field>
          <label className="flex items-start gap-3 border p-3">
            <input
              type="checkbox"
              checked={s.thinking}
              onChange={(e) => setS({ ...s, thinking: e.target.checked })}
              className="mt-0.5 size-4 accent-foreground"
            />
            <span>
              <span className="block text-sm font-medium">Deep thinking</span>
              <span className="block text-xs text-muted-foreground">
                Lets reasoning models (GLM, Nemotron, DeepSeek) think before replying. Better on hard questions, but replies can take up to a minute. Off keeps chat fast.
              </span>
            </span>
          </label>
          <Field label="Knowledge base" hint="Pricing, policies, FAQs. Sent with every reply.">
            <Textarea rows={10} value={s.knowledge} onChange={(e) => setS({ ...s, knowledge: e.target.value })} />
          </Field>
          <Button type="submit">{saved ? <><Check data-icon="inline-start" /> Saved</> : "Save"}</Button>
        </form>

        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Embed on your site</h2>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(embedSnippet())
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="flex w-full items-center gap-3 border bg-muted/30 px-4 py-3 text-left font-mono text-xs"
          >
            <code className="flex-1 truncate">{embedSnippet()}</code>
            {copied ? <Check className="size-4" /> : <Copy className="size-4 text-muted-foreground" />}
          </button>
          <p className="text-xs text-muted-foreground">Every conversation arrives in the sidebar as a ticket.</p>
        </section>

        <section className="space-y-2 border p-4 text-sm">
          <h2 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Memory backend</h2>
          {mode === "walrus" ? (
            <p>Walrus Memory is connected. Memories are Seal-encrypted by the relayer and stored on Walrus, one namespace per customer.</p>
          ) : (
            <p className="text-muted-foreground">
              Running on a local mock. Create an account at <a className="underline" href="https://memory.walrus.xyz" target="_blank" rel="noreferrer">memory.walrus.xyz</a>, then set <code>MEMWAL_PRIVATE_KEY</code> and <code>MEMWAL_ACCOUNT_ID</code> in <code>.env</code> and restart.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
