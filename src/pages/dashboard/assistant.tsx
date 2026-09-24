import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router"
import { BarChart3, FileText, Inbox, Users } from "lucide-react"
import { Orb } from "@/components/brand"
import { Dots } from "@/components/chat-widget"
import { Composer } from "@/components/composer"
import { ModelPicker } from "@/components/model-picker"
import { stream, timeAgo } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useDashboard } from "./context"

type Turn = { role: "user" | "assistant"; content: string }

const STARTERS = [
  { icon: Inbox, label: "Summarise open tickets" },
  { icon: Users, label: "Who's waiting on a human?" },
  { icon: BarChart3, label: "What do customers ask most?" },
  { icon: FileText, label: "Draft FAQ entries from recent chats" },
]

/** Operator home: ask AMI about your tickets. "New chat" remounts it fresh. */
export function Assistant() {
  const location = useLocation()
  return <Conversation key={(location.state as { reset?: number } | null)?.reset ?? 0} />
}

function Conversation() {
  const { tickets, status, reload } = useDashboard()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  async function ask(text: string) {
    const next: Turn[] = [...turns, { role: "user", content: text }]
    setTurns([...next, { role: "assistant", content: "" }])
    setInput("")
    setBusy(true)
    try {
      await stream("/api/assist", { turns: next }, (event, data) => {
        if (event === "delta")
          setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, content: x.content + (data as string) } : x)))
      })
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, content: (e as Error).message } : x)))
    }
    setBusy(false)
  }

  const botName = status?.settings.botName ?? "AMI"
  const company = status?.settings.company ?? "InterCall"
  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={() => void ask(input.trim())}
      busy={busy}
      placeholder="Ask about your tickets, customers or trends…"
      toolbar={<ModelPicker current={status?.model} onSaved={() => void reload()} />}
    />
  )

  if (turns.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
            {turns.map((t, i) => (
              <div key={i} className={cn("ic-rise flex gap-3", t.role === "user" && "justify-end")}>
                {t.role === "assistant" && <Orb className="mt-0.5 size-7 shrink-0" active={busy && i === turns.length - 1} />}
                <div className={cn("max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap", t.role === "user" ? "bg-primary px-4 py-2.5 text-primary-foreground" : "pt-1")}>
                  {t.content || <Dots />}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl px-4 pb-4">{composer}</div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="ic-glow pointer-events-none absolute inset-x-0 top-0 h-80" />
      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12">
        <Orb className="ic-float size-16" active />
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight sm:text-3xl">Hello 👋 how may I help you?</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          This is {botName}, the AI assistant from {company}, designed to make support easier.
        </p>
        <div className="mt-8 w-full">{composer}</div>
        <div className="mt-8 w-full">
          <div className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Some options to get started</div>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s.label}
                onClick={() => void ask(s.label)}
                className="flex items-center gap-2 border bg-muted/40 px-3 py-2 text-xs hover:border-foreground/40 hover:bg-muted"
              >
                <s.icon className="size-3.5 text-muted-foreground" /> {s.label}
              </button>
            ))}
          </div>
        </div>
        {tickets.length > 0 && (
          <div className="mt-10 w-full">
            <div className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Latest tickets</div>
            <div className="divide-y border">
              {tickets.slice(0, 5).map((t) => (
                <Link key={t.id} to={`/dashboard/t/${t.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                  <span className="font-mono text-xs text-muted-foreground">#{t.number}</span>
                  <span className={cn("truncate", t.unread && "font-semibold")}>{t.subject}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(t.updatedAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="relative pb-4 text-center text-[11px] text-muted-foreground">
        Customer memories are Seal-encrypted and stored on Walrus. Only your delegate key can recall them.
      </p>
    </div>
  )
}
