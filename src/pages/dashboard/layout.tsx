import { useCallback, useState } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router"
import { BadgeCheck, Check, Database, Home, PanelLeft, Plus, Settings, Share, Sparkles, Users, Zap } from "lucide-react"
import { Logo, Orb } from "@/components/brand"
import { WalletButton } from "@/components/wallet-button"
import { Button } from "@/components/ui/button"
import { api, embedSnippet, formatTokens, type Status, type TicketSummary } from "@/lib/api"
import { usePoll } from "@/lib/use-poll"
import { cn } from "@/lib/utils"
import type { Ctx } from "./context"


export function DashboardLayout() {
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [status, setStatus] = useState<Status>()
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  const reload = useCallback(async () => {
    const [t, s] = await Promise.all([api<TicketSummary[]>("/api/tickets"), api<Status>("/api/status")])
    setTickets(t)
    setStatus(s)
  }, [])

  // New widget chats appear here as tickets without a refresh.
  usePoll(reload, 4000, null)

  const used = status ? status.usage.inputTokens + status.usage.outputTokens : 0
  const pct = status ? Math.min(100, Math.round((used / status.tokenBudget) * 100)) : 0

  return (
    <div className="no-scrollbar flex h-svh bg-muted/40 text-foreground">
      {/* rail */}
      <aside className="hidden w-14 shrink-0 flex-col items-center justify-between border-r bg-background py-4 sm:flex">
        <Link to="/" aria-label="Home">
          <span className="grid size-9 place-items-center">
            <Orb className="size-10" />
          </span>
        </Link>
        <span className="grid size-9 place-items-center rounded-full bg-muted text-xs font-bold">OP</span>
      </aside>

      {/* sidebar */}
      <aside className={cn("shrink-0 flex-col border-r bg-background transition-all", collapsed ? "hidden" : "hidden w-64 md:flex")}>
        <div className="flex h-14 items-center justify-between px-4">
          <Logo className="text-sm" />
          <button aria-label="Collapse sidebar" onClick={() => setCollapsed(true)} className="p-1 text-muted-foreground hover:text-foreground">
            <PanelLeft className="size-4" />
          </button>
        </div>
        <nav className="space-y-0.5 px-2 text-sm">
          <SideLink to="/dashboard" end icon={Home}>Assistant</SideLink>
          <SideLink to="/dashboard/customers" icon={Users}>Customers</SideLink>
          <SideLink to="/dashboard/settings" icon={Settings}>Bot & embed</SideLink>
        </nav>
        <TicketList tickets={tickets} />
        <MemoryCard status={status} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4">
          {collapsed && (
            <button aria-label="Expand sidebar" onClick={() => setCollapsed(false)} className="hidden p-1 text-muted-foreground hover:text-foreground md:block">
              <PanelLeft className="size-4" />
            </button>
          )}
          <Zap className="size-3.5" />
          <span className="hidden text-xs font-medium sm:inline">Token usage</span>
          <div className="h-1.5 w-20 overflow-hidden bg-border sm:w-28">
            <div className="h-full bg-foreground transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
          <Link to="/dashboard/customers" className="text-xs text-muted-foreground hover:text-foreground" title="Token usage per customer">
            {pct}% · {formatTokens(used)}
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={() => {
                void navigator.clipboard.writeText(embedSnippet())
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check data-icon="inline-start" /> : <Share data-icon="inline-start" />}
              {copied ? "Embed copied" : "Share"}
            </Button>
            <Button size="sm" onClick={() => navigate("/dashboard", { state: { reset: Date.now() } })}>
              <Plus data-icon="inline-start" /> New chat
            </Button>
            <WalletButton variant="outline" />
          </div>
        </header>
        <main className="relative mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden border bg-background sm:mx-4 sm:mb-4">
          <Outlet context={{ tickets, status, reload } satisfies Ctx} />
        </main>
      </div>
    </div>
  )
}

function SideLink({ to, end, icon: Icon, children }: { to: string; end?: boolean; icon: typeof Home; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn("flex items-center gap-2.5 px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground", isActive && "bg-muted text-foreground")
      }
    >
      <Icon className="size-4" /> {children}
    </NavLink>
  )
}

function group(tickets: TicketSummary[]) {
  const day = 86400_000
  const today = new Date().setHours(0, 0, 0, 0)
  const groups: [string, TicketSummary[]][] = [["Today", []], ["Yesterday", []], ["Earlier", []]]
  for (const t of tickets) {
    groups[t.updatedAt >= today ? 0 : t.updatedAt >= today - day ? 1 : 2][1].push(t)
  }
  return groups.filter(([, ts]) => ts.length)
}

function TicketList({ tickets }: { tickets: TicketSummary[] }) {
  if (!tickets.length) {
    return (
      <div className="mx-4 mt-6 border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        No tickets yet. Chat through the widget on the{" "}
        <Link to="/" className="underline">landing page</Link> and it'll show up here live.
      </div>
    )
  }
  return (
    <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      {group(tickets).map(([label, ts]) => (
        <div key={label} className="mt-3">
          <div className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{label}</div>
          {ts.map((t) => (
            <NavLink
              key={t.id}
              to={`/dashboard/t/${t.id}`}
              className={({ isActive }) =>
                cn("group flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-muted", isActive && "bg-muted")
              }
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  t.status === "resolved" ? "bg-border" : t.mode === "autopilot" ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
              <span className={cn("truncate", t.unread ? "font-semibold" : "text-muted-foreground group-hover:text-foreground")}>
                {t.subject}
              </span>
              {t.customer?.tier === "verified" && <BadgeCheck className="ml-auto size-3.5 shrink-0 text-emerald-600" />}
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  )
}

function MemoryCard({ status }: { status?: Status }) {
  const live = status?.memoryMode === "walrus"
  return (
    <div className="m-3 mt-auto border bg-gradient-to-br from-fuchsia-500/5 to-violet-500/10 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        {live ? <Database className="size-3.5" /> : <Sparkles className="size-3.5" />}
        {live ? "Walrus Memory live" : "Memory: local mock"}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {live
          ? `${status?.counts.memories ?? 0} memories Seal-encrypted across ${status?.counts.customers ?? 0} customers.`
          : "Add MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID to .env to store memories on Walrus."}
      </p>
    </div>
  )
}
