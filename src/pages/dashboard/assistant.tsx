import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router"
import {
  BarChart3,
  ChevronDown,
  CircleCheck,
  FileText,
  Inbox,
  Users,
} from "lucide-react"
import { Orb } from "@/components/brand"
import { Dots } from "@/components/chat-widget"
import { Composer } from "@/components/composer"
import { ModelPicker } from "@/components/model-picker"
import { RichText } from "@/components/rich-text"
import { VoiceMode } from "@/components/voice-mode"
import { cleanReply, stream, timeAgo } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useDashboard } from "./context"

type Turn = { role: "user" | "assistant"; content: string; actions?: string[] }

const STARTERS = [
  { icon: Inbox, label: "Summarise open tickets" },
  { icon: Users, label: "Who's waiting on a human?" },
  { icon: BarChart3, label: "What do customers ask most?" },
  { icon: FileText, label: "Draft FAQ entries from recent chats" },
]

/** Operator home: ask AMI about your tickets. "New chat" remounts it fresh. */
export function Assistant() {
  const location = useLocation()
  return (
    <Conversation
      key={(location.state as { reset?: number } | null)?.reset ?? 0}
    />
  )
}

function Conversation() {
  const { tickets, status, reload } = useDashboard()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [showLatest, setShowLatest] = useState(false)
  const [showStarters, setShowStarters] = useState(false)
  const [voice, setVoice] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  // Voice mode asks again before re-rendering, so the history ask() builds on lives in a ref.
  const history = useRef<Turn[]>([])

  /** Sends a question and resolves with the full reply; `voice` asks for a spoken-style answer. */
  async function ask(text: string, voice = false) {
    const next: Turn[] = [...history.current, { role: "user", content: text }]
    history.current = next
    setTurns([...next, { role: "assistant", content: "" }])
    setInput("")
    setBusy(true)
    let reply = ""
    try {
      await stream("/api/assist", { turns: next, voice }, (event, data) => {
        if (event === "actions") {
          const actions = data as string[]
          setTurns((t) =>
            t.map((x, i) => (i === t.length - 1 ? { ...x, actions } : x))
          )
          void reload()
          return
        }
        if (event !== "delta") return
        reply += data as string
        setTurns((t) =>
          t.map((x, i) =>
            i === t.length - 1
              ? { ...x, content: x.content + (data as string) }
              : x
          )
        )
      })
    } catch (e) {
      reply = (e as Error).message
      setTurns((t) =>
        t.map((x, i) => (i === t.length - 1 ? { ...x, content: reply } : x))
      )
    }
    history.current = [...next, { role: "assistant", content: reply }]
    setBusy(false)
    return cleanReply(reply)
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
      toolbar={
        <ModelPicker current={status?.model} onSaved={() => void reload()} />
      }
      onVoice={() => setVoice(true)}
    />
  )
  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                "ic-rise flex gap-3",
                t.role === "user" && "justify-end"
              )}
            >
              {t.role === "assistant" && (
                <Orb
                  className="mt-0.5 size-7 shrink-0"
                  active={busy && i === turns.length - 1}
                />
              )}
              <div
                className={cn(
                  "max-w-[85%] text-sm leading-relaxed",
                  t.role === "user"
                    ? "bg-primary px-4 py-2.5 whitespace-pre-wrap text-primary-foreground"
                    : "min-w-0 pt-1"
                )}
              >
                {!t.content ? (
                  <Dots />
                ) : t.role === "user" ? (
                  t.content
                ) : (
                  <RichText text={cleanReply(t.content)} />
                )}
                {!!t.actions?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.actions.map((a) => (
                      <span
                        key={a}
                        className="flex items-center gap-1 border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-600"
                      >
                        <CircleCheck className="size-3" /> {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-2xl px-4 pb-4">{composer}</div>
    </div>
  )

  const home = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="ic-glow pointer-events-none absolute inset-x-0 top-0 h-80" />
      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12">
        <Orb className="ic-float size-16" active />
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Hello 👋 how may I help you?
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          This is {botName}, the AI assistant from {company}, designed to make
          support easier.
        </p>
        <div className="mt-8 w-full">{composer}</div>
        <div className="mt-8 w-full">
          <button
            onClick={() => setShowStarters((v) => !v)}
            aria-expanded={showStarters}
            className="mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase hover:text-foreground"
          >
            Some options to get started
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                !showStarters && "-rotate-90"
              )}
            />
          </button>
          <div
            className={cn("flex flex-wrap gap-2", !showStarters && "hidden")}
          >
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
            <button
              onClick={() => setShowLatest((v) => !v)}
              aria-expanded={showLatest}
              className="mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase hover:text-foreground"
            >
              Latest tickets
              <ChevronDown
                className={cn(
                  "size-3 transition-transform",
                  !showLatest && "-rotate-90"
                )}
              />
            </button>
            <div className={cn("divide-y border", !showLatest && "hidden")}>
              {tickets.slice(0, 5).map((t) => (
                <Link
                  key={t.id}
                  to={`/dashboard/t/${t.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    #{t.number}
                  </span>
                  <span className={cn("truncate", t.unread && "font-semibold")}>
                    {t.subject}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {timeAgo(t.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="relative pb-4 text-center text-[11px] text-muted-foreground">
        Customer memories are Seal-encrypted and stored on Walrus. Only your
        delegate key can recall them.
      </p>
    </div>
  )

  // One fixed slot for voice mode so it survives the switch from home to conversation view.
  return (
    <>
      {voice && (
        <VoiceMode
          onAsk={(text) => ask(text, true)}
          onClose={() => setVoice(false)}
          className="fixed inset-0"
        />
      )}
      {turns.length ? conversation : home}
    </>
  )
}
