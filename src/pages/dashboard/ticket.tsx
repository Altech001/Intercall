import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "react-router"
import { BadgeCheck, Bot, Brain, Check, ChevronDown, CircleCheck, Coins, Loader2, Lock, Mail, Phone, Plus, RotateCcw, Sparkles, Star, UserRound } from "lucide-react"
import { Orb } from "@/components/brand"
import { ChatCard } from "@/components/chat-cards"
import { RichText } from "@/components/rich-text"
import { Dots } from "@/components/chat-widget"
import { Composer, ToolButton } from "@/components/composer"
import { ModelPicker } from "@/components/model-picker"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api, cleanReply, formatTokens, shortAddr, stream, timeAgo, totalTokens, type Message, type ReplyMode, type TicketDetail } from "@/lib/api"
import { usePoll } from "@/lib/use-poll"
import { cn } from "@/lib/utils"
import { useDashboard } from "./context"

const MODES: { id: ReplyMode; icon: typeof Bot; label: string; hint: string }[] = [
  { id: "autopilot", icon: Bot, label: "Autopilot", hint: "AI answers the customer with memory" },
  { id: "copilot", icon: Sparkles, label: "Copilot", hint: "AI drafts, you review and send" },
  { id: "human", icon: UserRound, label: "Human only", hint: "AI stays silent on this ticket" },
]

export function TicketView() {
  const { id } = useParams()
  const { reload, status } = useDashboard()
  const [t, setT] = useState<TicketDetail>()
  const [error, setError] = useState<string>()
  const [input, setInput] = useState("")
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const count = t?.messages.length

  const load = useCallback(async () => {
    try {
      setT(await api<TicketDetail>(`/api/tickets/${id}`))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [id])

  usePoll(load, 3000, id)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" })
  }, [count])

  async function patch(body: Partial<Pick<TicketDetail, "status" | "mode" | "priority">>) {
    await api(`/api/tickets/${id}`, { method: "PATCH", body })
    await Promise.all([load(), reload()])
  }

  async function send() {
    setSending(true)
    try {
      await api(`/api/tickets/${id}/messages`, { body: { text: input } })
      setInput("")
      // Replying yourself takes the ticket off autopilot so the bot doesn't talk over you.
      if (t?.mode === "autopilot") await patch({ mode: "copilot" })
      else await load()
    } finally {
      setSending(false)
    }
  }

  async function draft() {
    setDrafting(true)
    setInput("")
    await stream(`/api/tickets/${id}/draft`, {}, (event, data) => {
      if (event === "delta") setInput((v) => v + (data as string))
    }).catch(() => {})
    setDrafting(false)
  }

  if (error) return <div className="grid flex-1 place-items-center text-sm text-muted-foreground">{error}</div>
  if (!t) return <div className="grid flex-1 place-items-center"><Dots /></div>

  const mode = MODES.find((m) => m.id === t.mode)!

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              <span className="font-mono">#{t.number}</span>
              <span>·</span>
              <span className={cn(t.status === "open" && "text-emerald-600", t.status === "pending" && "text-amber-600")}>{t.status}</span>
              {t.priority === "high" && <span className="text-foreground">· priority</span>}
            </div>
            <h1 className="truncate font-semibold">{t.subject}</h1>
          </div>
          {!!t.rating && (
            <span className="flex items-center gap-0.5 text-xs" title={`Customer rated ${t.rating}/5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn("size-3", n <= t.rating! ? "fill-amber-400 text-amber-400" : "text-border")} />
              ))}
            </span>
          )}
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground" title={`${t.tokens.input} in / ${t.tokens.output} out`}>
            <Coins className="size-3.5" /> {formatTokens(totalTokens(t.tokens))}
          </span>
          {t.status !== "resolved" ? (
            <Button size="sm" variant="outline" onClick={() => void patch({ status: "resolved" })}>
              <CircleCheck data-icon="inline-start" /> Resolve
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void patch({ status: "open" })}>
              <RotateCcw data-icon="inline-start" /> Reopen
            </Button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
            <p className="text-center text-[11px] text-muted-foreground">
              Opened {timeAgo(t.createdAt)} from the website widget
            </p>
            {t.messages.map((m) => (
              <Line key={m.id} m={m} />
            ))}
            <div ref={end} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl px-4 pb-4">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => void send()}
            busy={sending || drafting}
            placeholder={drafting ? "Drafting with memory…" : `Reply to the customer as a human${t.mode === "autopilot" ? " (switches to Copilot)" : ""}…`}
            toolbar={
              <>
                <ToolButton icon={Sparkles} onClick={() => void draft()} disabled={drafting}>
                  {drafting ? "Drafting…" : "Draft with AI"}
                </ToolButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-fuchsia-600 hover:bg-muted dark:text-fuchsia-400">
                      <mode.icon className="size-3.5" /> {mode.label} <ChevronDown className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuLabel className="text-xs">Who answers this customer?</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {MODES.map((m) => (
                      <DropdownMenuItem key={m.id} onSelect={() => void patch({ mode: m.id })} className="items-start py-2">
                        <m.icon className="mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm">{m.label}</div>
                          <div className="text-xs text-muted-foreground">{m.hint}</div>
                        </div>
                        {m.id === t.mode && <Check className="mt-0.5" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <ModelPicker current={status?.model} onSaved={() => void reload()} />
              </>
            }
          />
        </div>
      </section>

      <CustomerPanel t={t} onChange={load} />
    </div>
  )
}

function Line({ m }: { m: Message }) {
  if (m.role === "system") return null
  const customer = m.role === "customer"
  return (
    <div className={cn("ic-rise flex gap-3", customer ? "justify-start" : "justify-end")}>
      {customer && (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="size-3.5" />
        </span>
      )}
      <div className={cn("flex max-w-[80%] flex-col gap-1", !customer && "items-end")}>
        <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          {customer ? "Customer" : m.role === "ai" ? "AMI · AI" : "You · Human"} · {timeAgo(m.at)}
        </div>
        {m.text && (
          <div
            className={cn(
              "px-3.5 py-2.5 text-sm leading-relaxed",
              customer ? "bg-muted whitespace-pre-wrap" : m.role === "ai" ? "border bg-background" : "bg-primary text-primary-foreground"
            )}
          >
            {customer ? m.text : <RichText text={cleanReply(m.text)} />}
          </div>
        )}
        {m.ui && (
          <div className="w-72 text-left">
            <ChatCard ui={m.ui} submitted={m.submitted} disabled onSubmit={() => {}} />
            {!m.submitted && <div className="mt-1 text-[10px] text-muted-foreground">Waiting for the customer…</div>}
          </div>
        )}
        {!!m.memories?.length && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground" title={m.memories.map((x) => x.text).join("\n")}>
            <Brain className="size-3" /> used {m.memories.length} {m.memories.length === 1 ? "memory" : "memories"}
          </div>
        )}
      </div>
      {!customer && (m.role === "ai" ? <Orb className="mt-0.5 size-7 shrink-0" /> : <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">OP</span>)}
    </div>
  )
}

function CustomerPanel({ t, onChange }: { t: TicketDetail; onChange: () => Promise<void> }) {
  const [teach, setTeach] = useState("")
  const [saving, setSaving] = useState(false)
  const [remembering, setRemembering] = useState(false)
  const c = t.customerDetail
  if (!c) return null

  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l lg:flex">
      <div className="border-b p-5">
        <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Customer</div>
        {c.wallet ? (
          <div className="mt-2 flex items-center gap-2">
            <BadgeCheck className="size-4 text-emerald-600" />
            <span className="font-mono text-sm">{shortAddr(c.wallet)}</span>
          </div>
        ) : (
          <div className="mt-2 text-sm">Guest visitor</div>
        )}
        {c.name && <div className="mt-1 text-base font-semibold">{c.name}</div>}
        <div className="mt-2 space-y-1 text-xs">
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:underline">
              <Mail className="size-3 text-muted-foreground" /> {c.email}
            </a>
          )}
          {c.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 text-muted-foreground" /> {c.phone}
            </div>
          )}
          {Object.entries(c.details).map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}: </span>
              {v}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {c.wallet
            ? "Wallet-verified. Memory follows them across devices; routed as priority."
            : "Not wallet-connected. Memory is tied to this browser until they connect."}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-px border bg-border text-center">
          {[
            ["Tokens", formatTokens(totalTokens(c.tokens))],
            ["Tickets", c.ticketCount],
            ["Memories", c.memoryCount],
          ].map(([k, v]) => (
            <div key={k} className="bg-background px-2 py-2">
              <dd className="font-mono text-sm font-semibold">{v}</dd>
              <dt className="text-[9px] tracking-widest text-muted-foreground uppercase">{k}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-3 border-b p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">AMI's understanding</div>
          <button
            disabled={remembering}
            onClick={async () => {
              setRemembering(true)
              await api(`/api/tickets/${t.id}/remember`, { body: {} }).catch(() => {})
              setRemembering(false)
              await onChange()
            }}
            className="flex items-center gap-1 text-[10px] tracking-widest text-muted-foreground uppercase hover:text-foreground disabled:opacity-50"
            title="Summarise this conversation into Walrus Memory now"
          >
            {remembering ? <Loader2 className="size-3 animate-spin" /> : <Brain className="size-3" />} Save to memory
          </button>
        </div>
        <p className="text-xs leading-relaxed">
          {c.insight ?? <span className="text-muted-foreground">Builds up as they chat. Used to greet them and draft suggestions when they come back.</span>}
        </p>
        {t.summary && (
          <div className="border-l-2 pl-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">This conversation: </span>
            {t.summary}
          </div>
        )}
      </div>

      <div className="flex-1 p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            What {c.wallet ? "we" : "AMI"} remember{c.wallet ? "" : "s"}
          </div>
          <span className="text-xs text-muted-foreground">{t.memories.length}</span>
        </div>
        {t.memories.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Nothing yet. Facts are extracted from each exchange and stored on Walrus automatically.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {t.memories.map((m) => (
              <li key={m.id} className="ic-rise border bg-muted/30 p-2.5 text-xs leading-relaxed">
                {m.text}
                <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <Lock className="size-2.5" />
                  {m.blobId ? (
                    <a
                      href={`https://walruscan.com/${import.meta.env.VITE_WALRUS_NETWORK ?? "mainnet"}/blob/${m.blobId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:text-foreground hover:underline"
                    >
                      sealed · {m.blobId.slice(0, 14)}…
                    </a>
                  ) : (
                    <span>sealed · uploading</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 flex gap-1"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!teach.trim()) return
            setSaving(true)
            await api(`/api/customers/${c.id}/memories`, { body: { text: teach } }).catch(() => {})
            setTeach("")
            setSaving(false)
            await onChange()
          }}
        >
          <input
            value={teach}
            onChange={(e) => setTeach(e.target.value)}
            placeholder="Teach AMI a fact…"
            className="min-w-0 flex-1 border bg-transparent px-2.5 py-2 text-xs outline-none focus:border-foreground/40"
          />
          <button disabled={saving || !teach.trim()} aria-label="Add memory" className="grid size-8 place-items-center border hover:bg-muted disabled:opacity-40">
            <Plus className="size-3.5" />
          </button>
        </form>
      </div>
    </aside>
  )
}
