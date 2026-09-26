import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowUp, AudioLines, BadgeCheck, Brain, ChevronDown, CircleCheck, Lock, Maximize2, Minimize2, SquarePen, UserRound, X } from "lucide-react"
import { Orb } from "@/components/brand"
import { ChatCard } from "@/components/chat-cards"
import { RichText } from "@/components/rich-text"
import { VoiceMode } from "@/components/voice-mode"
import { WalletButton } from "@/components/wallet-button"
import {
  api,
  cleanReply,
  formatTokens,
  stream,
  totalTokens,
  type MemoryRef,
  type Message,
  type PublicCustomer,
  type ReplyMode,
  type UiBlock,
} from "@/lib/api"
import { identity, useIdentity } from "@/lib/identity"
import { usePoll } from "@/lib/use-poll"
import { useVoiceEnabled } from "@/lib/voice"
import { cn } from "@/lib/utils"

type Me = { customer: PublicCustomer; lastTicketId?: string; botName: string; company: string }
type Welcome = { returning: boolean; greeting: string; suggestions: string[] }
type Remembered = { text: string; blobId?: string; at: number }

const stamp = () => Date.now()
const BANNER_KEY = "intercall.walletBannerDismissed"
const WALRUS_NET = import.meta.env.VITE_WALRUS_NETWORK ?? "mainnet"

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

export function ChatWidget({ embedded = false, defaultOpen = false }: { embedded?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(embedded || defaultOpen)
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<"chat" | "memory">("chat")
  const id = useIdentity()
  const [me, setMe] = useState<Me>()
  const [welcome, setWelcome] = useState<Welcome>()
  const [ticketId, setTicketId] = useState<string>()
  const [messages, setMessages] = useState<Message[]>([])
  const [mode, setMode] = useState<ReplyMode>("autopilot")
  const [status, setStatus] = useState<string>("open")
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState("")
  const [seen, setSeen] = useState(0)
  const [hideBanner, setHideBanner] = useState(() => readFlag(BANNER_KEY))
  const [voice, setVoice] = useState(false)
  const canTalk = useVoiceEnabled()
  // Voice mode sends again before a re-render, so it reads the ticket from here.
  const ticketRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    ticketRef.current = ticketId
  }, [ticketId])
  const scroller = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener("intercall:open", show)
    return () => window.removeEventListener("intercall:open", show)
  }, [])

  // Who we are (re-runs after a wallet sign-in), then the personal welcome.
  useEffect(() => {
    api<Me>("/api/me", { body: identity.auth() })
      .then((m) => {
        setMe(m)
        setTicketId((t) => t ?? m.lastTicketId)
      })
      .catch(() => {})
    api<Welcome>("/api/welcome", { body: identity.auth() })
      .then(setWelcome)
      .catch(() => {})
  }, [id.token])

  const refresh = useCallback(async () => {
    if (!ticketId) return
    try {
      const t = await api<{ messages: Message[]; mode: ReplyMode; status: string }>(`/api/widget/tickets/${ticketId}`, { body: identity.auth() })
      setMode(t.mode)
      setStatus(t.status)
      setMessages((prev) => {
        const a = prev.at(-1)
        const b = t.messages.at(-1)
        return prev.length === t.messages.length && a?.id === b?.id && a?.text === b?.text && !!a?.submitted === !!b?.submitted
          ? prev
          : t.messages
      })
    } catch {
      setTicketId(undefined)
    }
  }, [ticketId])

  // Live while open; slower in the background so the launcher can show unread replies.
  usePoll(refresh, open ? 3500 : 12000, `${ticketId}-${open}`, !!ticketId && !busy)

  const replies = messages.filter((m) => m.role !== "customer").length
  const unread = open ? 0 : Math.max(0, replies - seen)
  if (open && seen !== replies) setSeen(replies)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [messages, open, view])

  // Auto-grow the composer.
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  // Esc shrinks the centered, expanded chat back to the corner.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && toggleExpand()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  function toggleExpand() {
    const next = !expanded
    setExpanded(next)
    if (embedded) window.parent.postMessage({ intercall: "expand", value: next }, "*")
  }

  function close() {
    if (embedded) window.parent.postMessage({ intercall: "close" }, "*")
    else setOpen(false)
  }

  function newConversation() {
    setTicketId(undefined)
    setMessages([])
    setMode("autopilot")
    setStatus("open")
    setView("chat")
    api<Welcome>("/api/welcome", { body: identity.auth() })
      .then(setWelcome)
      .catch(() => {})
  }

  /** Sends a message and resolves with the reply text (what voice mode reads aloud). */
  async function send(text: string, card?: { message: Message; values: Record<string, string> }, voice = false): Promise<string> {
    text = text.trim()
    if ((!text && !card) || busy) return ""
    setInput("")
    setBusy(true)
    setView("chat")
    const now = stamp()
    const draftId = `draft-${now}`
    setMessages((m) => [
      ...m.map((x) => (card && x.id === card.message.id ? { ...x, submitted: card.values } : x)),
      { id: `c-${now}`, role: "customer", text: text || summarize(card!.message.ui!, card!.values), at: now },
      { id: draftId, role: "ai", text: "", at: now },
    ])
    const patch = (fn: (m: Message) => Message) => setMessages((all) => all.map((m) => (m.id === draftId ? fn(m) : m)))
    let tid = ticketRef.current
    let reply = ""
    try {
      await stream(
        "/api/chat",
        { ...identity.auth(), ticketId: tid, text, voice, card: card && { messageId: card.message.id, values: card.values } },
        (event, data) => {
          if (event === "ticket") {
            tid = (data as { ticketId: string }).ticketId
            ticketRef.current = tid
            setTicketId(tid)
          } else if (event === "memories") patch((m) => ({ ...m, memories: data as MemoryRef[] }))
          else if (event === "delta") patch((m) => ({ ...m, text: m.text + (data as string) }))
          else if (event === "queued") {
            setMode((data as { mode: ReplyMode }).mode)
            setMessages((all) => all.filter((m) => m.id !== draftId))
            reply = "Thanks, I've passed that to the team. They'll reply here in the chat."
          } else if (event === "done") {
            const d = data as { message: Message; mode: ReplyMode; status: string }
            setMode(d.mode)
            setStatus(d.status)
            patch(() => d.message)
            reply = cleanReply(d.message.text)
            if (d.message.ui?.type === "form") reply += " I've put a short form in the chat for you."
          }
        }
      )
    } catch (e) {
      reply = (e as Error).message || "Couldn't reach support. Please try again."
      patch((m) => ({ ...m, text: reply }))
    }
    setBusy(false)
    if (tid) setTicketId(tid)
    return reply
  }

  const botName = me?.botName ?? "AMI"
  const verified = me?.customer.tier === "verified"
  const lastAi = [...messages].reverse().find((m) => m.role !== "customer")

  const panel = (
    <div
      role="dialog"
      aria-label={`Chat with ${botName}`}
      className={cn(
        "no-scrollbar relative flex flex-col overflow-hidden bg-background text-foreground",
        embedded
          ? "h-svh w-full"
          : cn(
              "ic-pop fixed z-50 border shadow-2xl transition-[width,height] duration-300",
              expanded
                ? // Centered on the page, over a dimmed backdrop.
                  "inset-0 m-auto h-[min(860px,calc(100svh-3rem))] w-[min(1080px,calc(100vw-2rem))] origin-center"
                : "right-4 bottom-24 h-[min(640px,calc(100svh-8rem))] w-[min(400px,calc(100vw-2rem))] sm:right-6"
            )
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-3 sm:gap-3 sm:px-4">
        {view === "memory" ? (
          <IconButton label="Back to chat" onClick={() => setView("chat")}>
            <ArrowLeft />
          </IconButton>
        ) : (
          <Orb className="size-9 shrink-0" active={busy} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {view === "memory" ? "What I remember" : botName}
            {verified && view === "chat" && <BadgeCheck className="size-3.5 text-emerald-600" aria-label="Wallet verified" />}
          </div>
          <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <span className={cn("inline-block size-1.5 shrink-0 rounded-full", mode === "autopilot" ? "animate-pulse bg-emerald-500" : "bg-amber-500")} />
            {view === "memory"
              ? `${me?.customer.memoryCount ?? 0} memories · Seal-encrypted`
              : mode === "autopilot"
                ? "Online · remembers you"
                : "A teammate is on this"}
          </div>
        </div>
        {view === "chat" && (
          <>
            <IconButton label="What I remember" onClick={() => setView("memory")}>
              <Brain />
            </IconButton>
            <IconButton label="New conversation" onClick={newConversation}>
              <SquarePen />
            </IconButton>
          </>
        )}
        <IconButton label={expanded ? "Shrink chat" : "Expand chat"} onClick={toggleExpand} className={embedded ? undefined : "hidden sm:grid"}>
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </IconButton>
        <IconButton label="Close chat" onClick={close}>
          <X />
        </IconButton>
      </header>

      {voice && <VoiceMode onAsk={(text) => send(text, undefined, true)} onClose={() => setVoice(false)} className="absolute inset-0" />}
      {view === "memory" ? (
        <MemoryView customer={me?.customer} verified={verified} />
      ) : (
        <>
          {!verified && !hideBanner && (
            <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2.5">
              <p className="flex-1 text-[11px] leading-snug text-muted-foreground">
                I remember you on this device. Connect a Sui wallet to carry that memory to any device and get priority support.
              </p>
              <WalletButton size="xs" />
              <button
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setHideBanner(true)
                  try {
                    localStorage.setItem(BANNER_KEY, "1")
                  } catch {
                    /* storage unavailable */
                  }
                }}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-5">
            <div className={cn("mx-auto space-y-4", expanded && "max-w-2xl")}>
              <Bubble role="ai" text={welcome?.greeting ?? `Hi, I'm ${botName}. How can I help?`} at={0} />
              {welcome?.returning && messages.length === 0 && (
                <p className="ic-rise flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Brain className="size-3" /> Suggestions drafted from what I remember about you
                </p>
              )}
              {messages.map((m) => (
                <Bubble
                  key={m.id}
                  role={m.role}
                  text={cleanReply(m.text)}
                  at={m.at}
                  memories={m.memories}
                  typing={busy && !m.text && m.role === "ai"}
                  card={
                    m.ui && (
                      <ChatCard
                        ui={m.ui}
                        submitted={m.submitted}
                        disabled={busy || (m.ui.type !== "form" && m.id !== lastAi?.id)}
                        onSubmit={(values) => void send("", { message: m, values })}
                      />
                    )
                  }
                />
              ))}
              {status === "resolved" && ticketId && !busy ? (
                <div className="ic-rise flex items-center justify-center gap-2 text-[10px] tracking-widest text-muted-foreground uppercase">
                  <span className="h-px flex-1 bg-border" />
                  <CircleCheck className="size-3 text-emerald-600" /> Resolved · write again anytime
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : (
                mode !== "autopilot" &&
                ticketId &&
                !busy && (
                  <p className="text-center text-[10px] tracking-widest text-muted-foreground uppercase">
                    Handed to the team · they'll reply here
                  </p>
                )
              )}
            </div>
          </div>

          {messages.length === 0 && !!welcome?.suggestions.length && (
            <div className={cn("flex flex-wrap gap-2 px-4 pb-3", expanded && "mx-auto w-full max-w-2xl")}>
              {welcome.suggestions.map((s, i) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="ic-rise border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className={cn("flex items-end gap-2 border-t p-3", expanded && "mx-auto w-full max-w-2xl")}
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <textarea
              ref={box}
              value={input}
              rows={1}
              placeholder={mode === "autopilot" ? "Write a message…" : "Write to the team…"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            {canTalk && (
              <button
                type="button"
                aria-label="Talk with voice"
                title="Talk with voice"
                disabled={busy}
                onClick={() => setVoice(true)}
                className="grid size-10 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <AudioLines className="size-4" />
              </button>
            )}
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim() || busy}
              className="grid size-10 shrink-0 place-items-center bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
        </>
      )}
      <div className="flex items-center justify-center gap-1.5 pb-2 text-[10px] text-muted-foreground">
        <Lock className="size-3" /> Memory Seal-encrypted on Walrus
      </div>
    </div>
  )

  if (embedded) return panel

  return (
    <>
      {open && expanded && !embedded && (
        <div aria-hidden onClick={toggleExpand} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-in fade-in" />
      )}
      {open && panel}
      <button
        aria-label={open ? "Close chat" : unread ? `Open chat, ${unread} new` : "Open chat"}
        onClick={() => setOpen((o) => !o)}
        className="group fixed right-4 bottom-4 z-50 size-16 rounded-full bg-[radial-gradient(circle_at_50%_35%,#2b4fd8,#0b1020_70%)] shadow-[0_10px_30px_-6px_rgba(43,79,216,0.6)] ring-2 ring-white/90 transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
      >
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <img
            src="/walrus-hero.avif"
            alt=""
            draggable={false}
            className="size-full origin-[50%_45%] scale-[1.04] object-cover object-top transition-transform duration-300 group-hover:scale-[1.12]"
          />
        </span>
        {open && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
            <ChevronDown className="size-6 text-white" />
          </span>
        )}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-bold text-white ring-2 ring-background">
            {unread}
          </span>
        )}
      </button>
    </>
  )
}

function summarize(ui: UiBlock, values: Record<string, string>) {
  if (ui.type === "choices") return values.choice
  if (ui.type === "rating") return `Rated ${values.rating}/5`
  return ui.title
}

function IconButton({ label, className, children, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn("grid size-8 shrink-0 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4", className)}
    >
      {children}
    </button>
  )
}

function MemoryView({ customer, verified }: { customer?: PublicCustomer; verified: boolean }) {
  const [items, setItems] = useState<Remembered[]>()
  useEffect(() => {
    api<Remembered[]>("/api/me/memories", { body: identity.auth() })
      .then(setItems)
      .catch(() => setItems([]))
  }, [])
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        This is what I've learned from our conversations. It's encrypted with Seal and stored on Walrus, and only this
        support desk can read it.{" "}
        {verified
          ? "It's tied to your wallet, so it follows you on any device."
          : "You don't need a wallet for this: I remember you on this device. Connecting one lets the same memory follow you everywhere."}
      </p>
      {!items ? (
        <Dots />
      ) : items.length === 0 ? (
        <div className="border border-dashed p-4 text-xs text-muted-foreground">Nothing yet. Chat with me and I'll remember what matters.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((m, i) => (
            <li key={i} className="ic-rise border p-3 text-sm" style={{ animationDelay: `${i * 30}ms` }}>
              {m.text}
              <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <Lock className="size-2.5" />
                {m.blobId ? (
                  <a href={`https://walruscan.com/${WALRUS_NET}/blob/${m.blobId}`} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    walrus · {m.blobId.slice(0, 12)}…
                  </a>
                ) : (
                  "sealing…"
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {customer && (
        <div className="flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
          <span>AI usage on your conversations</span>
          <span className="font-mono">{formatTokens(totalTokens(customer.tokens))} tokens</span>
        </div>
      )}
    </div>
  )
}

function Bubble({
  role,
  text,
  at,
  memories,
  typing,
  card,
}: {
  role: Message["role"]
  text: string
  at: number
  memories?: MemoryRef[]
  typing?: boolean
  card?: React.ReactNode
}) {
  const [showMem, setShowMem] = useState(false)
  if (role === "system") return null
  const mine = role === "customer"
  return (
    <div className={cn("ic-rise flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      {role === "agent" && (
        <span className="flex items-center gap-1 text-[10px] tracking-widest text-muted-foreground uppercase">
          <UserRound className="size-3" /> Human teammate
        </span>
      )}
      {(text || typing) && (
        <div
          className={cn(
            "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed wrap-break-word",
            mine ? "bg-primary whitespace-pre-wrap text-primary-foreground" : "bg-muted"
          )}
        >
          {typing ? <Dots /> : mine ? text : <RichText text={text} />}
        </div>
      )}
      {card && <div className="w-[85%] max-w-sm">{card}</div>}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {at > 0 && !typing && <span>{new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
        {!!memories?.length && (
          <button onClick={() => setShowMem((s) => !s)} className="flex items-center gap-1 hover:text-foreground">
            <Brain className="size-3" /> {memories.length} {memories.length === 1 ? "memory" : "memories"}
          </button>
        )}
      </div>
      {showMem && memories && (
        <ul className="max-w-[85%] space-y-1 border-l-2 pl-2 text-[11px] text-muted-foreground">
          {memories.map((m, i) => (
            <li key={i}>{m.text}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Dots() {
  return (
    <span className="inline-flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="ic-dot size-1.5 rounded-full bg-current opacity-50" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  )
}
